"""Submit the Matter Frontier Lab two-qubit Grover demo to IBM Quantum.

Prerequisites:
    pip install "qiskit~=2.5" "qiskit-ibm-runtime~=0.47"

The script deliberately contains no token. Configure a user-owned IBM Quantum
account with QiskitRuntimeService.save_account(...) before running it.
"""

from qiskit import QuantumCircuit
from qiskit.transpiler import generate_preset_pass_manager
from qiskit_ibm_runtime import QiskitRuntimeService, SamplerV2 as Sampler


SHOTS = 4096

service = QiskitRuntimeService()
backend = service.least_busy(operational=True, simulator=False, min_num_qubits=2)

circuit = QuantumCircuit(2)
circuit.h([0, 1])
circuit.cz(0, 1)  # Oracle: mark |11>.
circuit.h([0, 1])
circuit.x([0, 1])
circuit.cz(0, 1)  # Grover diffusion phase.
circuit.x([0, 1])
circuit.h([0, 1])
circuit.measure_all()

pass_manager = generate_preset_pass_manager(backend=backend, optimization_level=1)
isa_circuit = pass_manager.run(circuit)
sampler = Sampler(mode=backend)
job = sampler.run([isa_circuit], shots=SHOTS)

print("backend:", backend.name)
print("job id:", job.job_id())
print("counts:", job.result()[0].data.meas.get_counts())
