/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SanitizedReviewItem } from './zipParser.ts';

/**
 * High-fidelity benchmark sample items modeled directly after the T7 Blinded Review Set structure.
 * These ensure the portal has realistic data on first load even before the admin uploads a ZIP.
 */
export const SAMPLE_T7_ITEMS: SanitizedReviewItem[] = [
  {
    id: 'R001',
    requirement_prompt:
      'Design an active-high synchronous alarm latch module. The latch must assert an alarm signal whenever the fault input is asserted on a clock edge and remain asserted until an active-high reset signal is applied. If both fault and reset occur simultaneously on the same clock cycle, reset must take strict priority and clear the alarm.',
    module_ports:
      'MODULE PORTS:\ninput wire clk,\ninput wire rst_n, // active-low asynchronous system reset\ninput wire sync_rst, // synchronous clear with priority\ninput wire fault,\noutput reg alarm',
    model_question: [
      'Should the alarm output register update on the rising edge or falling edge of the clock signal, and does sync_rst take precedence over an active fault if both assert in the same cycle?',
    ],
    oracle_answer:
      'The alarm register must update exclusively on the positive (rising) clock edge. sync_rst has strict priority over fault.',
    generated_response: `\`default_nettype none
module alarm_latch (
    input  wire clk,
    input  wire rst_n,
    input  wire sync_rst,
    input  wire fault,
    output reg  alarm
);

always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
        alarm <= 1'b0;
    end else if (sync_rst) begin
        alarm <= 1'b0;
    end else if (fault) begin
        alarm <= 1'b1;
    end
end

endmodule`,
    code_language: 'verilog',
  },
  {
    id: 'R002',
    requirement_prompt:
      'Implement a 2-entry circular FIFO with single-cycle push and pop operations, 8-bit data width, and instantaneous full and empty status flags. Simultaneous read and write on a non-empty, non-full FIFO must succeed in the same clock cycle without data corruption.',
    module_ports:
      'MODULE PORTS:\ninput wire clk,\ninput wire rst_n,\ninput wire push,\ninput wire pop,\ninput wire [7:0] data_in,\noutput reg [7:0] data_out,\noutput wire full,\noutput wire empty',
    model_question: [
      'When the FIFO is empty and push is asserted simultaneously with pop, should data pass directly through (fall-through) or should pop be treated as invalid and ignored?',
    ],
    oracle_answer:
      'When empty, simultaneous push and pop is not a pass-through mode; push writes into slot 0 and pop is ignored because the FIFO was empty at the cycle start.',
    generated_response: `module fifo_2entry (
    input  wire       clk,
    input  wire       rst_n,
    input  wire       push,
    input  wire       pop,
    input  wire [7:0] data_in,
    output wire [7:0] data_out,
    output wire       full,
    output wire       empty
);

    reg [7:0] mem [0:1];
    reg [1:0] count;
    reg wr_ptr;
    reg rd_ptr;

    assign empty = (count == 2'd0);
    assign full  = (count == 2'd2);
    assign data_out = mem[rd_ptr];

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            count  <= 2'd0;
            wr_ptr <= 1'b0;
            rd_ptr <= 1'b0;
        end else begin
            case ({push && !full, pop && !empty})
                2'b10: begin
                    mem[wr_ptr] <= data_in;
                    wr_ptr <= ~wr_ptr;
                    count  <= count + 1'b1;
                end
                2'b01: begin
                    rd_ptr <= ~rd_ptr;
                    count  <= count - 1'b1;
                end
                2'b11: begin
                    mem[wr_ptr] <= data_in;
                    wr_ptr <= ~wr_ptr;
                    rd_ptr <= ~rd_ptr;
                end
                default: ;
            endcase
        end
    end

endmodule`,
    code_language: 'verilog',
  },
  {
    id: 'R003',
    requirement_prompt:
      'Construct a 4-client round-robin arbiter with fair token rotation. The arbiter receives 4 request signals (req[3:0]) and grants exactly one client per cycle (grant[3:0]). If no requests are active, grant must be 4\'b0000.',
    module_ports:
      'MODULE PORTS:\ninput wire clk,\ninput wire rst_n,\ninput wire [3:0] req,\noutput reg [3:0] grant',
    model_question: [],
    oracle_answer: '',
    generated_response: `module round_robin_arbiter_4 (
    input  wire       clk,
    input  wire       rst_n,
    input  wire [3:0] req,
    output reg  [3:0] grant
);

    reg [1:0] last_grant_ptr;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            grant <= 4'b0000;
            last_grant_ptr <= 2'd0;
        end else begin
            // Simplified priority rotation
            if (req == 4'b0000) begin
                grant <= 4'b0000;
            end else begin
                case (last_grant_ptr)
                    2'd0: begin
                        if (req[1]) grant <= 4'b0010;
                        else if (req[2]) grant <= 4'b0100;
                        else if (req[3]) grant <= 4'b1000;
                        else grant <= 4'b0001;
                    end
                    2'd1: begin
                        if (req[2]) grant <= 4'b0100;
                        else if (req[3]) grant <= 4'b1000;
                        else if (req[0]) grant <= 4'b0001;
                        else grant <= 4'b0010;
                    end
                    default: grant <= 4'b0001;
                endcase
            end
        end
    end

endmodule`,
    code_language: 'verilog',
  },
  {
    id: 'R004',
    requirement_prompt:
      'Develop an 8-bit priority encoder with valid flag output. Input in[7:0] has in[7] as highest priority and in[0] as lowest. Output code[2:0] corresponds to the highest asserted input bit.',
    module_ports:
      'MODULE PORTS:\ninput wire [7:0] in,\noutput reg [2:0] code,\noutput reg valid',
    model_question: [],
    oracle_answer: '',
    generated_response: `module priority_encoder_8 (
    input  wire [7:0] in,
    output reg  [2:0] code,
    output reg        valid
);

always @(*) begin
    valid = 1'b1;
    casex (in)
        8'b1xxxxxxx: code = 3'd7;
        8'b01xxxxxx: code = 3'd6;
        8'b001xxxxx: code = 3'd5;
        8'b0001xxxx: code = 3'd4;
        8'b00001xxx: code = 3'd3;
        8'b000001xx: code = 3'd2;
        8'b0000001x: code = 3'd1;
        8'b00000001: code = 3'd0;
        default: begin
            code  = 3'd0;
            valid = 1'b0;
        end
    endcase
end

endmodule`,
    code_language: 'verilog',
  },
  {
    id: 'R005',
    requirement_prompt:
      'Design a two-flop synchronizer module with pulse edge detection for crossing clock domains from a slow asynchronous domain to a fast 100MHz system clock domain.',
    module_ports:
      'MODULE PORTS:\ninput wire clk,\ninput wire rst_n,\ninput wire async_pulse,\noutput wire sync_pulse_out',
    model_question: [
      'Is the async_pulse signal guaranteed to be at least two system clock cycles wide, or must an input latch capture sub-cycle glitches?',
    ],
    oracle_answer:
      'The async_pulse is at least two destination clock periods wide. Standard double-register synchronizer without glitch-capture latch is expected.',
    generated_response: `module cdc_synchronizer (
    input  wire clk,
    input  wire rst_n,
    input  wire async_pulse,
    output wire sync_pulse_out
);

    reg meta_reg;
    reg sync_reg;
    reg prev_reg;

    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) begin
            meta_reg <= 1'b0;
            sync_reg <= 1'b0;
            prev_reg <= 1'b0;
        end else begin
            meta_reg <= async_pulse;
            sync_reg <= meta_reg;
            prev_reg <= sync_reg;
        end
    end

    assign sync_pulse_out = sync_reg & ~prev_reg;

endmodule`,
    code_language: 'verilog',
  },
  {
    id: 'R006',
    requirement_prompt:
      'Implement an active-high synchronous alarm latch module. The latch must assert an alarm signal whenever the fault input is asserted on a clock edge and remain asserted until an active-high reset signal is applied. If both fault and reset occur simultaneously on the same clock cycle, reset must take strict priority and clear the alarm.',
    module_ports:
      'MODULE PORTS:\ninput wire clk,\ninput wire rst_n,\ninput wire sync_rst,\ninput wire fault,\noutput reg alarm',
    model_question: [
      'Should alarm assert immediately combinations-wise or strictly register on clock edge?',
    ],
    oracle_answer:
      'Strictly registered on the positive clock edge.',
    generated_response: `module alarm_latch_v2 (
    input  wire clk,
    input  wire rst_n,
    input  wire sync_rst,
    input  wire fault,
    output reg  alarm
);

always @(posedge clk or negedge rst_n) begin
    if (!rst_n) begin
        alarm <= 1'b0;
    end else begin
        if (fault) alarm <= 1'b1;
        if (sync_rst) alarm <= 1'b0; // sync_rst evaluated second for priority
    end
end

endmodule`,
    code_language: 'verilog',
  },
];
