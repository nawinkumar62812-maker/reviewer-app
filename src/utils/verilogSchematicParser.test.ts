/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseBitRange,
  parseVerilogToCircuit,
  stepCircuitSimulation,
  createInitialSimulation,
} from './verilogSchematicParser';

test('parseBitRange parses single-bit and multi-bit vectors accurately', () => {
  assert.deepEqual(parseBitRange(undefined), { width: 1, msb: 0, lsb: 0 });
  assert.deepEqual(parseBitRange('[7:0]'), { width: 8, msb: 7, lsb: 0 });
  assert.deepEqual(parseBitRange('[3:0]'), { width: 4, msb: 3, lsb: 0 });
});

test('parseVerilogToCircuit extracts ports, registers, nodes, and wires for alarm_latch', () => {
  const code = `
    module alarm_latch (
        input  wire clk,
        input  wire rst_n,
        input  wire sync_rst,
        input  wire fault,
        output reg  alarm
    );
    always @(posedge clk or negedge rst_n) begin
        if (!rst_n) alarm <= 1'b0;
        else if (sync_rst) alarm <= 1'b0;
        else if (fault) alarm <= 1'b1;
    end
    endmodule
  `;

  const circuit = parseVerilogToCircuit(code);
  assert.equal(circuit.moduleName, 'alarm_latch');
  assert.equal(circuit.ports.length, 5);
  assert.equal(circuit.ports.filter((p) => p.direction === 'input').length, 4);
  assert.equal(circuit.ports.filter((p) => p.direction === 'output').length, 1);
  assert.ok(circuit.nodes.some((n) => n.category === 'DFF'));
  assert.ok(circuit.wires.length >= 4);
});

test('stepCircuitSimulation enforces sync_rst priority over fault in alarm_latch', () => {
  const code = `
    module alarm_latch (
        input wire clk,
        input wire rst_n,
        input wire sync_rst,
        input wire fault,
        output reg alarm
    );
    endmodule
  `;
  const circuit = parseVerilogToCircuit(code);

  // Fault asserts alarm when rst_n=1 and sync_rst=0
  let state = stepCircuitSimulation(circuit, { rst_n: 1, sync_rst: 0, fault: 1, alarm: 0 }, 1);
  assert.equal(state.alarm, 1);

  // Simultaneous fault=1 and sync_rst=1 clears alarm (strict priority)
  state = stepCircuitSimulation(circuit, { rst_n: 1, sync_rst: 1, fault: 1, alarm: 1 }, 2);
  assert.equal(state.alarm, 0);
});

test('parseVerilogToCircuit and createInitialSimulation handle multi-bit FIFO with memory array', () => {
  const code = `
    module fifo_2entry (
        input wire clk,
        input wire rst_n,
        input wire push,
        input wire pop,
        input wire [7:0] data_in,
        output wire [7:0] data_out,
        output wire full,
        output wire empty
    );
        reg [7:0] mem [0:1];
        reg [1:0] count;
        reg wr_ptr;
        reg rd_ptr;
    endmodule
  `;
  const circuit = parseVerilogToCircuit(code);
  assert.equal(circuit.moduleName, 'fifo_2entry');
  assert.ok(circuit.internalRegs.some((r) => r.name === 'mem' && r.isMemory === true));

  const sim = createInitialSimulation(circuit);
  assert.equal(sim.history.length, 8);
  assert.equal(sim.cycle, 8);
});
