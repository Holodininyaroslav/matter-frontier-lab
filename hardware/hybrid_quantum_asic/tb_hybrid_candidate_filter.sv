`timescale 1ns/1ps
module tb_hybrid_candidate_filter;
  logic clk=0, rst_n=0, in_valid=0, out_ready=1;
  logic in_ready, conserved, pauli_allowed, out_valid, accepted;
  logic [1:0] candidate_id, color_triality, accepted_id;
  logic signed [15:0] candidate_energy, decay_threshold, binding_margin;
  logic [15:0] uncertainty;
  always #5 clk=~clk;
  hybrid_candidate_filter dut(.*);
  initial begin
    candidate_id=3; conserved=1; color_triality=0; pauli_allowed=1;
    candidate_energy=2219; decay_threshold=2231; uncertainty=5;
    #12 rst_n=1; #8 in_valid=1; #10 in_valid=0; #2;
    if (!accepted || accepted_id != 3 || binding_margin != 12)
      $fatal(1, "eligible candidate was not emitted");
    color_triality=1; #8 in_valid=1; #10 in_valid=0; #2;
    if (accepted) $fatal(1, "non-singlet candidate was accepted");
    $display("PASS hybrid_candidate_filter"); $finish;
  end
endmodule
