from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_antelope_contract_exposes_complete_scientific_work_lifecycle() -> None:
    source = (ROOT / "blockchain/contracts/mflchain/mflchain.cpp").read_text(encoding="utf-8")
    for action in ["init", "regworker", "createtask", "addshard", "claim", "commit", "verify", "settle"]:
        assert f"ACTION {action}" in source
        assert f"({action})" in source.split("EOSIO_DISPATCH", 1)[1]
    assert 'get_index<"bystate"_n>()' in source
    assert 'check(shard->status == verified' in source
    assert "worker reward counter overflow" in source


def test_contract_build_file_uses_antelope_cdt_contract_target() -> None:
    cmake = (ROOT / "blockchain/contracts/mflchain/CMakeLists.txt").read_text(encoding="utf-8")
    assert "find_package(eosio.cdt)" in cmake
    assert "add_contract(mflchain mflchain mflchain.cpp)" in cmake
