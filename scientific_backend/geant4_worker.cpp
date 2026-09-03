#include "FTFP_BERT.hh"
#include "G4Box.hh"
#include "G4Event.hh"
#include "G4LogicalVolume.hh"
#include "G4NistManager.hh"
#include "G4ParticleGun.hh"
#include "G4ParticleTable.hh"
#include "G4PVPlacement.hh"
#include "G4RunManagerFactory.hh"
#include "G4Step.hh"
#include "G4SystemOfUnits.hh"
#include "G4UserEventAction.hh"
#include "G4UserSteppingAction.hh"
#include "G4VUserDetectorConstruction.hh"
#include "G4VUserPrimaryGeneratorAction.hh"
#include "G4Version.hh"

#include <algorithm>
#include <cmath>
#include <iomanip>
#include <iostream>
#include <stdexcept>
#include <string>

namespace {
struct Configuration {
  std::string particle = "gamma";
  std::string material = "G4_Si";
  double energyMeV = 1.0;
  double thicknessMm = 10.0;
  int events = 100;
};

struct Totals {
  double depositedMeV = 0.0;
  double depositedSquaredMeV2 = 0.0;
  long secondaries = 0;
  long steps = 0;
  double eventDepositedMeV = 0.0;
  long eventSecondaries = 0;
};

class Detector final : public G4VUserDetectorConstruction {
 public:
  explicit Detector(const Configuration &configuration) : configuration_(configuration) {}
  G4VPhysicalVolume *Construct() override {
    auto *nist = G4NistManager::Instance();
    auto *vacuum = nist->FindOrBuildMaterial("G4_Galactic");
    auto *targetMaterial = nist->FindOrBuildMaterial(configuration_.material);
    if (!targetMaterial) throw std::runtime_error("Unknown material: " + configuration_.material);
    auto *worldSolid = new G4Box("World", 50.0 * cm, 50.0 * cm, 50.0 * cm);
    auto *worldLogical = new G4LogicalVolume(worldSolid, vacuum, "World");
    auto *world = new G4PVPlacement(nullptr, {}, worldLogical, "World", nullptr, false, 0, true);
    auto halfThickness = std::max(configuration_.thicknessMm, 0.001) * mm / 2.0;
    auto *targetSolid = new G4Box("Target", 5.0 * cm, 5.0 * cm, halfThickness);
    targetLogical_ = new G4LogicalVolume(targetSolid, targetMaterial, "Target");
    new G4PVPlacement(nullptr, {}, targetLogical_, "Target", worldLogical, false, 0, true);
    return world;
  }
  G4LogicalVolume *TargetLogical() const { return targetLogical_; }
 private:
  Configuration configuration_;
  G4LogicalVolume *targetLogical_ = nullptr;
};

class PrimaryGenerator final : public G4VUserPrimaryGeneratorAction {
 public:
  explicit PrimaryGenerator(const Configuration &configuration) : gun_(1) {
    auto *definition = G4ParticleTable::GetParticleTable()->FindParticle(configuration.particle);
    if (!definition) throw std::runtime_error("Unknown particle: " + configuration.particle);
    gun_.SetParticleDefinition(definition);
    gun_.SetParticleEnergy(configuration.energyMeV * MeV);
    gun_.SetParticlePosition({0.0, 0.0, -20.0 * cm});
    gun_.SetParticleMomentumDirection({0.0, 0.0, 1.0});
  }
  void GeneratePrimaries(G4Event *event) override { gun_.GeneratePrimaryVertex(event); }
 private:
  G4ParticleGun gun_;
};

class EventAction final : public G4UserEventAction {
 public:
  explicit EventAction(Totals &totals) : totals_(totals) {}
  void BeginOfEventAction(const G4Event *) override {
    totals_.eventDepositedMeV = 0.0;
    totals_.eventSecondaries = 0;
  }
  void EndOfEventAction(const G4Event *) override {
    totals_.depositedMeV += totals_.eventDepositedMeV;
    totals_.depositedSquaredMeV2 += totals_.eventDepositedMeV * totals_.eventDepositedMeV;
    totals_.secondaries += totals_.eventSecondaries;
  }
 private:
  Totals &totals_;
};

class SteppingAction final : public G4UserSteppingAction {
 public:
  SteppingAction(const Detector &detector, Totals &totals) : detector_(detector), totals_(totals) {}
  void UserSteppingAction(const G4Step *step) override {
    auto *volume = step->GetPreStepPoint()->GetTouchableHandle()->GetVolume()->GetLogicalVolume();
    if (volume != detector_.TargetLogical()) return;
    totals_.eventDepositedMeV += step->GetTotalEnergyDeposit() / MeV;
    totals_.eventSecondaries += static_cast<long>(step->GetSecondaryInCurrentStep()->size());
    totals_.steps += 1;
  }
 private:
  const Detector &detector_;
  Totals &totals_;
};

std::string argument(int argc, char **argv, const std::string &name, const std::string &fallback) {
  for (int i = 1; i + 1 < argc; ++i) if (std::string(argv[i]) == name) return argv[i + 1];
  return fallback;
}
bool hasFlag(int argc, char **argv, const std::string &name) {
  for (int i = 1; i < argc; ++i) if (std::string(argv[i]) == name) return true;
  return false;
}
}  // namespace

int main(int argc, char **argv) {
  try {
    if (hasFlag(argc, argv, "--status")) {
      std::cout << "MFL_JSON:{\"available\":true,\"engine\":\"geant4-cpp-wsl\",\"geant4\":\""
                << G4Version << "\",\"physicsList\":\"FTFP_BERT\"}" << std::endl;
      return 0;
    }
    Configuration configuration;
    configuration.particle = argument(argc, argv, "--particle", configuration.particle);
    configuration.material = argument(argc, argv, "--material", configuration.material);
    configuration.energyMeV = std::stod(argument(argc, argv, "--energy-mev", "1.0"));
    configuration.thicknessMm = std::stod(argument(argc, argv, "--thickness-mm", "10.0"));
    configuration.events = std::max(1, std::stoi(argument(argc, argv, "--events", "100")));

    Totals totals;
    auto *runManager = G4RunManagerFactory::CreateRunManager(G4RunManagerType::Serial);
    auto *detector = new Detector(configuration);
    runManager->SetUserInitialization(detector);
    auto *physics = new FTFP_BERT(0);
    physics->SetVerboseLevel(0);
    runManager->SetUserInitialization(physics);
    runManager->SetUserAction(new PrimaryGenerator(configuration));
    runManager->SetUserAction(new EventAction(totals));
    runManager->SetUserAction(new SteppingAction(*detector, totals));
    runManager->Initialize();
    runManager->BeamOn(configuration.events);
    double mean = totals.depositedMeV / configuration.events;
    double variance = std::max(0.0, totals.depositedSquaredMeV2 / configuration.events - mean * mean);
    std::cout << std::setprecision(12)
              << "MFL_JSON:{\"ok\":true,\"engine\":\"geant4-cpp-wsl\",\"geant4\":\"" << G4Version
              << "\",\"physicsList\":\"FTFP_BERT\",\"particle\":\"" << configuration.particle
              << "\",\"material\":\"" << configuration.material << "\",\"energyMeV\":" << configuration.energyMeV
              << ",\"thicknessMm\":" << configuration.thicknessMm << ",\"events\":" << configuration.events
              << ",\"meanDepositedMeV\":" << mean << ",\"rmsDepositedMeV\":" << std::sqrt(variance)
              << ",\"secondaryCount\":" << totals.secondaries << ",\"targetStepCount\":" << totals.steps << "}" << std::endl;
    delete runManager;
    return 0;
  } catch (const std::exception &error) {
    std::cerr << "Geant4 worker error: " << error.what() << std::endl;
    return 2;
  }
}
