#include "Pythia8/Pythia.h"
#include "HepMC3/GenEvent.h"
#include "HepMC3/GenParticle.h"
#include "HepMC3/GenVertex.h"
#include "HepMC3/WriterAscii.h"

#include <cmath>
#include <cstdlib>
#include <iomanip>
#include <iostream>
#include <memory>
#include <sstream>
#include <string>
#include <vector>

using namespace Pythia8;
static constexpr double INSTALLED_PYTHIA_VERSION = 8.186;

static std::string argument(int argc, char** argv, const std::string& key, const std::string& fallback) {
  for (int i = 1; i + 1 < argc; ++i) if (argv[i] == key) return argv[i + 1];
  return fallback;
}

static const char* track_type(int id, double charge) {
  const int absolute = std::abs(id);
  if (id == 22) return "photon";
  if (absolute == 11) return id > 0 ? "electron" : "positron";
  if (absolute == 13) return "muon";
  if (absolute == 12 || absolute == 14 || absolute == 16) return "neutrino";
  return std::abs(charge) > 1e-12 ? "chargedHadron" : "neutralHadron";
}

int main(int argc, char** argv) {
  if (argc > 1 && std::string(argv[1]) == "--status") {
    std::cout << "{\"available\":true,\"engine\":\"pythia8-hepmc3-wsl\",\"pythia\":"
              << std::fixed << std::setprecision(3) << INSTALLED_PYTHIA_VERSION
              << ",\"hepmc3\":\"3.1.2\"}";
    return 0;
  }

  const int idA = std::stoi(argument(argc, argv, "--beam-a", "2212"));
  const int idB = std::stoi(argument(argc, argv, "--beam-b", "2212"));
  const int seed = std::max(1, std::min(900000000, std::stoi(argument(argc, argv, "--seed", "1"))));
  const double eCM = std::max(10.0, std::stod(argument(argc, argv, "--ecm-gev", "13600")));
  const double pTHatMin = std::max(1.0, std::stod(argument(argc, argv, "--pt-hat-min", "20")));
  const std::string mode = argument(argc, argv, "--mode", "softQCD");
  const std::string hepmcPath = argument(argc, argv, "--hepmc", "");

  std::ostringstream generatorLog;
  std::streambuf* original = std::cout.rdbuf(generatorLog.rdbuf());
  Pythia pythia("/usr/share/pythia8-data/xmldoc", false);
  pythia.readString("Print:quiet = on");
  pythia.readString("Next:numberShowInfo = 0");
  pythia.readString("Next:numberShowProcess = 0");
  pythia.readString("Next:numberShowEvent = 0");
  pythia.readString("Random:setSeed = on");
  pythia.readString("Random:seed = " + std::to_string(seed));
  pythia.readString("Beams:frameType = 1");
  pythia.readString("Beams:idA = " + std::to_string(idA));
  pythia.readString("Beams:idB = " + std::to_string(idB));
  pythia.readString("Beams:eCM = " + std::to_string(eCM));
  if (mode == "hardQCD") {
    pythia.readString("HardQCD:all = on");
    pythia.readString("PhaseSpace:pTHatMin = " + std::to_string(pTHatMin));
  } else {
    pythia.readString("SoftQCD:all = on");
  }
  const bool initialized = pythia.init();
  const bool generated = initialized && pythia.next();
  std::cout.rdbuf(original);
  if (!generated) {
    std::cout << "{\"ok\":false,\"error\":\"PYTHIA failed to initialise or generate the requested event\"}";
    return 2;
  }

  auto hepmcEvent = std::make_shared<HepMC3::GenEvent>(HepMC3::Units::GEV, HepMC3::Units::MM);
  hepmcEvent->set_event_number(seed);
  auto vertex = std::make_shared<HepMC3::GenVertex>(HepMC3::FourVector(0.0, 0.0, 0.0, 0.0));
  hepmcEvent->add_vertex(vertex);

  struct Track { int id; double charge, phi, theta, momentum, px, py, pz, energy, mass, eta, pt; const char* type; };
  std::vector<Track> tracks;
  for (int i = 0; i < pythia.event.size(); ++i) {
    const Particle& particle = pythia.event[i];
    if (!particle.isFinal()) continue;
    const double charge = particle.charge();
    const double theta = std::atan2(particle.pT(), particle.pz());
    tracks.push_back({particle.id(), charge, particle.phi(), theta, particle.pAbs(), particle.px(), particle.py(), particle.pz(), particle.e(), particle.m(), particle.eta(), particle.pT(), track_type(particle.id(), charge)});
    vertex->add_particle_out(std::make_shared<HepMC3::GenParticle>(HepMC3::FourVector(particle.px(), particle.py(), particle.pz(), particle.e()), particle.id(), 1));
  }
  if (!hepmcPath.empty()) {
    HepMC3::WriterAscii writer(hepmcPath);
    writer.write_event(*hepmcEvent);
    writer.close();
  }

  std::cout << std::setprecision(15) << "{\"ok\":true,\"pythiaVersion\":" << INSTALLED_PYTHIA_VERSION
            << ",\"hepmc3Version\":\"3.1.2\",\"seed\":" << seed << ",\"eCM_GeV\":" << eCM
            << ",\"mode\":\"" << mode << "\",\"sigmaGen_mb\":" << pythia.info.sigmaGen() << ",\"tracks\":[";
  for (std::size_t i = 0; i < tracks.size(); ++i) {
    if (i) std::cout << ',';
    const Track& t = tracks[i];
    std::cout << "{\"pdgId\":" << t.id << ",\"type\":\"" << t.type << "\",\"charge\":" << t.charge
              << ",\"phi\":" << t.phi << ",\"theta\":" << t.theta << ",\"momentum\":" << t.momentum
              << ",\"px\":" << t.px << ",\"py\":" << t.py << ",\"pz\":" << t.pz << ",\"energy\":" << t.energy
              << ",\"mass\":" << t.mass << ",\"eta\":" << t.eta << ",\"pt\":" << t.pt << ",\"origin\":[0,0,0]}";
  }
  std::cout << "]}";
  return 0;
}
