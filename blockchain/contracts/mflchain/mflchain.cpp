#include <eosio/eosio.hpp>
#include <eosio/singleton.hpp>
#include <eosio/crypto.hpp>
#include <limits>

using namespace eosio;
using std::string;

CONTRACT mflchain : public contract {
 public:
  using contract::contract;

  ACTION init(name authority) {
    require_auth(get_self());
    check(is_account(authority), "authority account does not exist");
    config_singleton config(get_self(), get_self().value);
    check(!config.exists(), "contract is already initialized");
    config.set(config_row{authority, 1}, get_self());
  }

  ACTION regworker(name owner, uint8_t kind, checksum256 capability_hash) {
    require_auth(owner);
    check(kind <= 4, "unknown worker kind");
    workers_table workers(get_self(), get_self().value);
    auto existing = workers.find(owner.value);
    if (existing == workers.end()) {
      workers.emplace(owner, [&](auto& row) {
        row.owner = owner;
        row.kind = kind;
        row.capability_hash = capability_hash;
        row.active = true;
      });
    } else {
      workers.modify(existing, same_payer, [&](auto& row) {
        row.kind = kind;
        row.capability_hash = capability_hash;
        row.active = true;
      });
    }
  }

  ACTION createtask(name sponsor, uint64_t task_id, checksum256 manifest_hash,
                    uint32_t total_shards, uint64_t reward_per_shard) {
    require_auth(sponsor);
    check(total_shards > 0 && total_shards <= 1000000, "invalid shard count");
    check(reward_per_shard > 0, "reward must be positive");
    tasks_table tasks(get_self(), get_self().value);
    check(tasks.find(task_id) == tasks.end(), "task already exists");
    tasks.emplace(sponsor, [&](auto& row) {
      row.task_id = task_id;
      row.sponsor = sponsor;
      row.manifest_hash = manifest_hash;
      row.total_shards = total_shards;
      row.reward_per_shard = reward_per_shard;
      row.created_at = current_time_point();
    });
  }

  ACTION addshard(uint64_t shard_id, uint64_t task_id, uint32_t cell_index,
                  checksum256 state_hash, checksum256 parameters_hash) {
    require_authority();
    tasks_table tasks(get_self(), get_self().value);
    auto task = tasks.require_find(task_id, "task not found");
    check(cell_index < task->total_shards, "cell index outside task range");
    shards_table shards(get_self(), get_self().value);
    check(shards.find(shard_id) == shards.end(), "shard id already exists");
    auto by_state = shards.get_index<"bystate"_n>();
    if (by_state.find(state_hash) != by_state.end()) {
      tasks.modify(task, same_payer, [&](auto& row) { row.reused_shards += 1; });
      return;
    }
    shards.emplace(get_self(), [&](auto& row) {
      row.shard_id = shard_id;
      row.task_id = task_id;
      row.cell_index = cell_index;
      row.state_hash = state_hash;
      row.parameters_hash = parameters_hash;
      row.status = pending;
    });
  }

  ACTION claim(name worker, uint64_t shard_id) {
    require_auth(worker);
    workers_table workers(get_self(), get_self().value);
    auto registered = workers.require_find(worker.value, "worker is not registered");
    check(registered->active, "worker is inactive");
    shards_table shards(get_self(), get_self().value);
    auto shard = shards.require_find(shard_id, "shard not found");
    check(shard->status == pending, "shard is not pending");
    shards.modify(shard, same_payer, [&](auto& row) {
      row.worker = worker;
      row.status = claimed;
      row.updated_at = current_time_point();
    });
  }

  ACTION commit(name worker, uint64_t shard_id, checksum256 result_hash,
                checksum256 artifact_hash) {
    require_auth(worker);
    shards_table shards(get_self(), get_self().value);
    auto shard = shards.require_find(shard_id, "shard not found");
    check(shard->status == claimed && shard->worker == worker, "worker does not own this claim");
    shards.modify(shard, same_payer, [&](auto& row) {
      row.result_hash = result_hash;
      row.artifact_hash = artifact_hash;
      row.status = committed;
      row.updated_at = current_time_point();
    });
  }

  ACTION verify(uint64_t shard_id, bool accepted, checksum256 verification_hash) {
    require_authority();
    shards_table shards(get_self(), get_self().value);
    auto shard = shards.require_find(shard_id, "shard not found");
    check(shard->status == committed, "shard is not committed");
    shards.modify(shard, same_payer, [&](auto& row) {
      row.verification_hash = verification_hash;
      row.status = accepted ? verified : pending;
      if (!accepted) row.worker = name{};
      row.updated_at = current_time_point();
    });
  }

  ACTION settle(uint64_t shard_id) {
    require_authority();
    shards_table shards(get_self(), get_self().value);
    auto shard = shards.require_find(shard_id, "shard not found");
    check(shard->status == verified, "shard is not verified");
    tasks_table tasks(get_self(), get_self().value);
    auto task = tasks.require_find(shard->task_id, "task not found");
    workers_table workers(get_self(), get_self().value);
    auto worker = workers.require_find(shard->worker.value, "worker not found");
    check(worker->jobs_completed < std::numeric_limits<uint64_t>::max(), "worker job counter overflow");
    check(worker->reward_units <= std::numeric_limits<uint64_t>::max() - task->reward_per_shard,
          "worker reward counter overflow");
    check(task->verified_shards < task->total_shards, "task verified count overflow");
    workers.modify(worker, same_payer, [&](auto& row) {
      row.jobs_completed += 1;
      row.reward_units += task->reward_per_shard;
    });
    tasks.modify(task, same_payer, [&](auto& row) { row.verified_shards += 1; });
    shards.modify(shard, same_payer, [&](auto& row) {
      row.reward_units = task->reward_per_shard;
      row.status = settled;
      row.updated_at = current_time_point();
    });
  }

 private:
  static constexpr uint8_t pending = 0;
  static constexpr uint8_t claimed = 1;
  static constexpr uint8_t committed = 2;
  static constexpr uint8_t verified = 3;
  static constexpr uint8_t settled = 4;

  TABLE config_row {
    name authority;
    uint32_t protocol_version;
  };
  using config_singleton = singleton<"config"_n, config_row>;

  TABLE worker_row {
    name owner;
    uint8_t kind = 0;  // CPU=0, GPU=1, quantum-simulator=2, QPU=3, FPGA=4
    checksum256 capability_hash;
    bool active = true;
    uint64_t jobs_completed = 0;
    uint64_t reward_units = 0;
    uint64_t primary_key() const { return owner.value; }
  };
  using workers_table = multi_index<"workers"_n, worker_row>;

  TABLE task_row {
    uint64_t task_id;
    name sponsor;
    checksum256 manifest_hash;
    uint32_t total_shards = 0;
    uint32_t verified_shards = 0;
    uint32_t reused_shards = 0;
    uint64_t reward_per_shard = 0;
    time_point created_at;
    uint64_t primary_key() const { return task_id; }
  };
  using tasks_table = multi_index<"tasks"_n, task_row>;

  TABLE shard_row {
    uint64_t shard_id;
    uint64_t task_id;
    uint32_t cell_index = 0;
    checksum256 state_hash;
    checksum256 parameters_hash;
    name worker;
    checksum256 result_hash;
    checksum256 artifact_hash;
    checksum256 verification_hash;
    uint8_t status = pending;
    uint64_t reward_units = 0;
    time_point updated_at;
    uint64_t primary_key() const { return shard_id; }
    checksum256 by_state() const { return state_hash; }
  };
  using shards_table = multi_index<
      "shards"_n, shard_row,
      indexed_by<"bystate"_n, const_mem_fun<shard_row, checksum256, &shard_row::by_state>>>;

  config_row require_authority() const {
    config_singleton config(get_self(), get_self().value);
    check(config.exists(), "contract is not initialized");
    auto value = config.get();
    require_auth(value.authority);
    return value;
  }
};

EOSIO_DISPATCH(mflchain, (init)(regworker)(createtask)(addshard)(claim)(commit)(verify)(settle))
