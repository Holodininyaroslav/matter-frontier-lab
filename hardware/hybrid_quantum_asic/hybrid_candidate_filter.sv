// Matter Frontier Lab — small hybrid ASIC + CUDA-Q demonstrator
// Synthesizable integer filter. The quantum kernel runs after this RTL stage.
// This module is an architectural teaching example, not a QCD solver.
module hybrid_candidate_filter #(
  parameter int EW = 16
) (
  input  logic                 clk,
  input  logic                 rst_n,
  input  logic                 in_valid,
  output logic                 in_ready,
  input  logic        [1:0]    candidate_id,
  input  logic                 conserved,
  input  logic        [1:0]    color_triality,
  input  logic                 pauli_allowed,
  input  logic signed [EW-1:0] candidate_energy,
  input  logic signed [EW-1:0] decay_threshold,
  input  logic        [EW-1:0] uncertainty,
  output logic                 out_valid,
  input  logic                 out_ready,
  output logic                 accepted,
  output logic        [1:0]    accepted_id,
  output logic signed [EW-1:0] binding_margin
);
  logic signed [EW-1:0] margin_next;
  logic                 constraints_ok;

  always_comb begin
    in_ready      = ~out_valid | out_ready;
    margin_next   = decay_threshold - candidate_energy;
    constraints_ok = conserved
                  && (color_triality == 2'b00)
                  && pauli_allowed;
  end

  always_ff @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
      out_valid      <= 1'b0;
      accepted       <= 1'b0;
      accepted_id    <= 2'b00;
      binding_margin <= '0;
    end else if (in_ready) begin
      out_valid      <= in_valid;
      accepted       <= in_valid && constraints_ok
                     && (margin_next > $signed({1'b0, uncertainty[EW-2:0]}));
      accepted_id    <= candidate_id;
      binding_margin <= margin_next;
    end
  end
endmodule
