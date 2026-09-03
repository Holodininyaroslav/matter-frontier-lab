// Matter Frontier Lab — Multi-Quark hardware prototype
// Synthesizable SystemVerilog workload filter for FPGA/ASIC experiments.
// This module is not a lattice-QCD solver and is not evidence for a bound state.
module multiquark_physics_frontend #(
  parameter int QW = 8,
  parameter int EW = 32
) (
  input  logic                   clk,
  input  logic                   rst_n,
  input  logic                   in_valid,
  output logic                   in_ready,
  input  logic signed [QW-1:0]   charge3,
  input  logic signed [QW-1:0]   target_charge3,
  input  logic signed [QW-1:0]   baryon3,
  input  logic signed [QW-1:0]   target_baryon3,
  input  logic signed [QW-1:0]   strangeness,
  input  logic signed [QW-1:0]   target_strangeness,
  input  logic        [1:0]      color_triality,
  input  logic                   pauli_allowed,
  input  logic signed [EW-1:0]   candidate_energy,
  input  logic signed [EW-1:0]   decay_threshold,
  input  logic        [EW-1:0]   uncertainty,
  output logic                   out_valid,
  input  logic                   out_ready,
  output logic                   accepted,
  output logic signed [EW-1:0]   binding_margin,
  output logic        [1:0]      stability_class
);
  logic signed [EW-1:0] margin_next;
  logic conserved_next;

  always_comb begin
    in_ready       = ~out_valid | out_ready;
    margin_next    = decay_threshold - candidate_energy;
    conserved_next = (charge3 == target_charge3)
                  && (baryon3 == target_baryon3)
                  && (strangeness == target_strangeness);
  end

  always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      out_valid       <= 1'b0;
      accepted        <= 1'b0;
      binding_margin  <= '0;
      stability_class <= 2'b00;
    end else if (in_ready) begin
      out_valid      <= in_valid;
      accepted       <= in_valid && conserved_next
                     && (color_triality == 2'b00) && pauli_allowed;
      binding_margin <= margin_next;
      if (margin_next > $signed({1'b0, uncertainty[EW-2:0]}) * 2)
        stability_class <= 2'b11; // bound within selected model
      else if (margin_next > $signed({1'b0, uncertainty[EW-2:0]}))
        stability_class <= 2'b10; // likely bound within model
      else if (margin_next >= -$signed({1'b0, uncertainty[EW-2:0]}))
        stability_class <= 2'b01; // near threshold / unresolved
      else
        stability_class <= 2'b00; // unbound within selected model
    end
  end
endmodule
