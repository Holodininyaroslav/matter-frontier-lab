`timescale 1ns/1ps
module tb_multiquark_physics_frontend;
  logic clk=0, rst_n=0, in_valid=0, out_ready=1, pauli_allowed;
  logic in_ready, out_valid, accepted;
  logic signed [7:0] charge3, target_charge3, baryon3, target_baryon3;
  logic signed [7:0] strangeness, target_strangeness;
  logic [1:0] color_triality, stability_class;
  logic signed [31:0] candidate_energy, decay_threshold, binding_margin;
  logic [31:0] uncertainty;

  always #5 clk=~clk;
  multiquark_physics_frontend dut(.*);

  initial begin
    charge3=0; target_charge3=0; baryon3=6; target_baryon3=6;
    strangeness=-2; target_strangeness=-2; color_triality=0;
    pauli_allowed=1; candidate_energy=2225; decay_threshold=2231; uncertainty=5;
    #12 rst_n=1; #8 in_valid=1; #10 in_valid=0; #2;
    if (!accepted || binding_margin != 6) $fatal(1, "valid candidate rejected");
    color_triality=1; #8 in_valid=1; #10 in_valid=0; #2;
    if (accepted) $fatal(1, "non-singlet candidate accepted");
    $display("PASS multiquark SystemVerilog frontend");
    $finish;
  end
endmodule
