/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  Cpu,
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  Activity,
  GitCommit,
  Layers,
  Zap,
  Sliders,
} from 'lucide-react';
import {
  ParsedCircuit,
  CircuitNode,
  parseVerilogToCircuit,
  stepCircuitSimulation,
  createInitialSimulation,
} from '../../utils/verilogSchematicParser.ts';

interface CircuitVisualizerProps {
  itemId: string;
  code: string;
  modulePorts: string;
}

export const CircuitVisualizer: React.FC<CircuitVisualizerProps> = ({
  itemId,
  code,
  modulePorts,
}) => {
  // Parse Verilog into circuit schematic graph
  const circuit: ParsedCircuit = useMemo(
    () => parseVerilogToCircuit(code, modulePorts),
    [code, modulePorts]
  );

  // Simulation state
  const [simState, setSimState] = useState(() => createInitialSimulation(circuit));
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'schematic' | 'waveform' | 'netlist'>('schematic');
  const [zoom, setZoom] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredCycle, setHoveredCycle] = useState<number | null>(null);

  // Re-initialize simulation when item changes
  useEffect(() => {
    setSimState(createInitialSimulation(circuit));
    setSelectedNodeId(null);
    setZoom(1);
  }, [itemId, circuit]);

  // Step clock +1 cycle
  const handleStepClock = () => {
    setSimState((prev) => {
      const nextCycle = prev.cycle + 1;
      const nextSignals = stepCircuitSimulation(circuit, prev.signals, nextCycle);
      const nextHistory = [
        ...prev.history.slice(-11),
        {
          cycle: nextCycle,
          clockPhase: 1 as const,
          values: { ...nextSignals },
        },
      ];
      return {
        cycle: nextCycle,
        signals: nextSignals,
        history: nextHistory,
      };
    });
  };

  // Auto-step timer when live simulation is playing
  useEffect(() => {
    if (!isRunning) return;
    const timer = setInterval(() => {
      setSimState((prev) => {
        const nextCycle = prev.cycle + 1;
        const mutated = { ...prev.signals };
        // Periodically toggle stimulus inputs so live waveform & schematic stay dynamic
        circuit.ports
          .filter((p) => p.direction === 'input' && !p.isClock && !p.isReset)
          .forEach((p, idx) => {
            if (p.width === 1) {
              if ((nextCycle + idx) % 3 === 0) {
                mutated[p.name] = mutated[p.name] ? 0 : 1;
              }
            } else {
              const mask = (1 << Math.min(8, p.width)) - 1;
              mutated[p.name] = ((mutated[p.name] || 1) + (nextCycle % 5) + 1) & mask;
            }
          });

        const nextSignals = stepCircuitSimulation(circuit, mutated, nextCycle);
        const nextHistory = [
          ...prev.history.slice(-11),
          {
            cycle: nextCycle,
            clockPhase: 1 as const,
            values: { ...nextSignals },
          },
        ];
        return {
          cycle: nextCycle,
          signals: nextSignals,
          history: nextHistory,
        };
      });
    }, 1400);
    return () => clearInterval(timer);
  }, [isRunning, circuit]);

  // Toggle or increment an input signal pin directly
  const handleToggleInputPin = (portName: string, width: number) => {
    setSimState((prev) => {
      const currentVal = prev.signals[portName] || 0;
      const mask = (1 << Math.min(8, width)) - 1;
      const nextVal = width === 1 ? (currentVal ? 0 : 1) : (currentVal + 1) & mask;
      const updatedInput = { ...prev.signals, [portName]: nextVal };
      const evaluated = stepCircuitSimulation(circuit, updatedInput, prev.cycle);

      const updatedHistory = [...prev.history];
      if (updatedHistory.length > 0) {
        updatedHistory[updatedHistory.length - 1] = {
          ...updatedHistory[updatedHistory.length - 1],
          values: { ...evaluated },
        };
      }
      return {
        ...prev,
        signals: evaluated,
        history: updatedHistory,
      };
    });
  };

  const handleResetSimulation = () => {
    setIsRunning(false);
    setSimState(createInitialSimulation(circuit));
  };

  // Format signal value in Verilog literal notation (e.g., 1'b1 or 8'h42)
  const formatSignalValue = (val: number | undefined, width: number): string => {
    const num = val ?? 0;
    if (width === 1) {
      return `1'b${num & 1}`;
    }
    if (width <= 4) {
      return `${width}'b${(num & ((1 << width) - 1)).toString(2).padStart(width, '0')}`;
    }
    const hexChars = Math.ceil(width / 4);
    return `${width}'h${num.toString(16).toUpperCase().padStart(hexChars, '0')}`;
  };

  // Determine whether a wire or node is currently driven HIGH
  const isNodeHigh = (node: CircuitNode): boolean => {
    if (node.category === 'INPUT_PORT' || node.category === 'OUTPUT_PORT') {
      return (simState.signals[node.label] || 0) > 0;
    }
    if (node.outputs.length > 0) {
      const outSig = node.outputs[0];
      if (outSig in simState.signals) {
        return (simState.signals[outSig] || 0) > 0;
      }
    }
    // Check if any driving input is high
    const nonClkInputs = circuit.ports.filter((p) => p.direction === 'input' && !p.isClock && !p.isReset);
    return nonClkInputs.some((p) => (simState.signals[p.name] || 0) > 0);
  };

  const selectedNode = useMemo(
    () => circuit.nodes.find((n) => n.id === selectedNodeId) || null,
    [circuit.nodes, selectedNodeId]
  );

  // Map node ID to node for fast wire path lookup
  const nodeMap = useMemo(() => {
    const map = new Map<string, CircuitNode>();
    circuit.nodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [circuit.nodes]);

  const inputPorts = useMemo(
    () => circuit.ports.filter((p) => p.direction === 'input'),
    [circuit.ports]
  );
  const outputPorts = useMemo(
    () => circuit.ports.filter((p) => p.direction === 'output'),
    [circuit.ports]
  );

  return (
    <div
      data-testid="circuit-visualizer"
      className={`${
        isFullscreen
          ? 'fixed inset-4 z-50 flex flex-col'
          : 'relative'
      } rounded-2xl bg-slate-950 text-slate-100 border border-slate-800 shadow-lg overflow-hidden transition-all`}
    >
      {/* Top EDA Telemetry Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/95 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
            <Cpu className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-100">
                RTL Hardware Schematic & Logic Analyzer
              </h3>
              <span className="font-mono text-[11px] font-semibold text-cyan-400">
                {circuit.moduleName}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono tabular-nums mt-0.5">
              <span>{circuit.ports.length} Ports</span>
              <span>·</span>
              <span>{circuit.metrics.flipFlopCount} Flip-Flops</span>
              <span>·</span>
              <span>{circuit.metrics.muxCount} Mux Stages</span>
              <span>·</span>
              <span>Cycle #{simState.cycle}</span>
            </div>
          </div>
        </div>

        {/* Mode Switcher Tabs & Simulation Transport */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg bg-slate-950 p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('schematic')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === 'schematic'
                  ? 'bg-cyan-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <GitCommit className="h-3.5 w-3.5" />
              <span>Schematic</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('waveform')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === 'waveform'
                  ? 'bg-cyan-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="h-3.5 w-3.5" />
              <span>Waveform</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('netlist')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === 'netlist'
                  ? 'bg-cyan-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="h-3.5 w-3.5" />
              <span>Netlist</span>
            </button>
          </div>

          {/* Simulation Controls */}
          <div className="flex items-center gap-1 rounded-lg bg-slate-950 p-1 border border-slate-800">
            <button
              type="button"
              onClick={() => setIsRunning(!isRunning)}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                isRunning
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
              title={isRunning ? 'Pause live clock simulation' : 'Run live clock simulation'}
            >
              {isRunning ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              <span>{isRunning ? 'Live' : 'Run'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsRunning(false);
                handleStepClock();
              }}
              className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors whitespace-nowrap"
              title="Advance simulation by +1 positive clock edge"
            >
              <SkipForward className="h-3.5 w-3.5" />
              <span>Step +1</span>
            </button>

            <button
              type="button"
              onClick={handleResetSimulation}
              className="flex items-center justify-center rounded-md p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              title="Reset simulation state"
              aria-label="Reset simulation"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>

          {activeTab === 'schematic' && (
            <div className="flex items-center gap-0.5 rounded-lg border border-slate-800 bg-slate-950 p-1">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.75, +(z - 0.15).toFixed(2)))}
                className="p-1 text-slate-400 hover:text-white transition-colors"
                aria-label="Zoom out"
                title="Zoom out"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </button>
              <span className="px-1 font-mono text-[10px] text-slate-300 tabular-nums">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(1.45, +(z + 0.15).toFixed(2)))}
                className="p-1 text-slate-400 hover:text-white transition-colors"
                aria-label="Zoom in"
                title="Zoom in"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-800 bg-slate-950 text-slate-400 hover:text-white transition-colors"
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen schematic'}
            title={isFullscreen ? 'Exit fullscreen' : 'Expand schematic'}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Interactive Pin Stimulus Strip */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 bg-slate-900/50 px-4 py-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1 text-[11px] font-mono uppercase tracking-wider text-slate-400 mr-1">
            <Sliders className="h-3 w-3 text-cyan-400" />
            Input Stimulus (Click to Toggle):
          </span>
          {inputPorts.map((inp) => {
            const val = simState.signals[inp.name] ?? 0;
            const isHigh = val > 0;
            return (
              <button
                key={inp.id}
                type="button"
                onClick={() => handleToggleInputPin(inp.name, inp.width)}
                className={`flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px] transition-all cursor-pointer ${
                  inp.isClock
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                    : isHigh
                    ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-300 font-semibold'
                    : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600'
                }`}
              >
                <span>{inp.name}</span>
                <span className="text-[10px] opacity-80">=</span>
                <span className="tabular-nums">{formatSignalValue(val, inp.width)}</span>
              </button>
            );
          })}
        </div>

        {/* Live Output Probe Readout */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
            Outputs:
          </span>
          {outputPorts.map((outp) => {
            const val = simState.signals[outp.name] ?? 0;
            const isHigh = val > 0;
            return (
              <div
                key={outp.id}
                className={`flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[11px] ${
                  isHigh
                    ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-300 font-semibold'
                    : 'border-slate-800 bg-slate-900 text-slate-400'
                }`}
              >
                <span>{outp.name}</span>
                <span className="text-[10px] opacity-80">=</span>
                <span className="tabular-nums">{formatSignalValue(val, outp.width)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Viewport Stage */}
      <div className="relative flex-1 bg-[#070B14]">
        {activeTab === 'schematic' && (
          <div className="relative overflow-x-auto overflow-y-hidden">
            {/* Interactive SVG CAD Schematic Canvas */}
            <svg
              viewBox="0 0 1080 500"
              className="w-full h-auto min-w-[680px] select-none transition-transform duration-150"
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'center center',
              }}
              role="img"
              aria-label={`Interactive hardware schematic diagram for module ${circuit.moduleName}`}
            >
              <defs>
                {/* Blueprint Micro-Grid */}
                <pattern id="eda-subgrid" width="20" height="20" patternUnits="userSpaceOnUse">
                  <path
                    d="M 20 0 L 0 0 0 20"
                    fill="none"
                    stroke="rgba(51, 65, 85, 0.22)"
                    strokeWidth="0.6"
                  />
                </pattern>
                <pattern id="eda-majorgrid" width="100" height="100" patternUnits="userSpaceOnUse">
                  <rect width="100" height="100" fill="url(#eda-subgrid)" />
                  <path
                    d="M 100 0 L 0 0 0 100"
                    fill="none"
                    stroke="rgba(71, 85, 105, 0.38)"
                    strokeWidth="1"
                  />
                </pattern>

                {/* Gate Metallic Surface Gradient */}
                <linearGradient id="gate-surface" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#1E293B" />
                  <stop offset="100%" stopColor="#0F172A" />
                </linearGradient>

                <linearGradient id="dff-surface" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0F2942" />
                  <stop offset="100%" stopColor="#091929" />
                </linearGradient>
              </defs>

              {/* Background Grid & Stage Column Headers */}
              <rect width="1080" height="500" fill="url(#eda-majorgrid)" />

              {/* Stage Zone Labels */}
              {[
                { x: 85, title: 'STAGE 0 · INPUT PINS' },
                { x: 305, title: 'STAGE 1 · DECODE / ALU' },
                { x: 535, title: 'STAGE 2 · MUX / ARBITER' },
                { x: 765, title: 'STAGE 3 · SEQUENTIAL STATE' },
                { x: 985, title: 'STAGE 4 · OUTPUT PINS' },
              ].map((zone) => (
                <g key={zone.title} transform={`translate(${zone.x}, 22)`}>
                  <text
                    textAnchor="middle"
                    className="fill-slate-500 font-mono text-[10px] tracking-widest uppercase"
                  >
                    {zone.title}
                  </text>
                  <line
                    x1="-70"
                    y1="8"
                    x2="70"
                    y2="8"
                    stroke="rgba(71, 85, 105, 0.4)"
                    strokeWidth="1"
                  />
                </g>
              ))}

              {/* Module Chip Boundary Box */}
              <rect
                x="195"
                y="42"
                width="685"
                height="430"
                rx="14"
                fill="rgba(15, 23, 42, 0.35)"
                stroke="rgba(56, 189, 248, 0.25)"
                strokeWidth="1.5"
                strokeDasharray="6 4"
              />
              <text
                x="212"
                y="62"
                className="fill-cyan-400/70 font-mono text-[11px] font-semibold"
              >
                MODULE: {circuit.moduleName.toUpperCase()} ({circuit.metrics.clockDomain})
              </text>

              {/* Render Netlist Wires & Buses */}
              {circuit.wires.map((wire) => {
                const fromNode = nodeMap.get(wire.fromNodeId);
                const toNode = nodeMap.get(wire.toNodeId);
                if (!fromNode || !toNode) return null;

                const x1 = fromNode.x + (fromNode.category === 'INPUT_PORT' ? 54 : 68);
                const y1 = fromNode.y;
                const x2 = toNode.x - (toNode.category === 'OUTPUT_PORT' ? 54 : 68);
                const y2 = toNode.y;

                const isActive = isNodeHigh(fromNode);
                const isBus = wire.width > 1;

                // Construct orthogonal / smooth cubic path
                let pathD = '';
                if (wire.isFeedback) {
                  // Route feedback loop cleanly above the logic stages
                  const topChannelY = 74;
                  pathD = `M ${x1} ${y1} L ${x1 + 22} ${y1} L ${x1 + 22} ${topChannelY} L ${
                    x2 - 22
                  } ${topChannelY} L ${x2 - 22} ${y2} L ${x2} ${y2}`;
                } else {
                  const midX = (x1 + x2) / 2;
                  pathD = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
                }

                const strokeColor = wire.isClockNet
                  ? '#F59E0B'
                  : wire.isResetNet
                  ? '#F43F5E'
                  : isActive
                  ? '#10B981'
                  : '#475569';

                const strokeWidth = isBus ? 3.2 : wire.isClockNet ? 1.6 : 2;
                const midX = (x1 + x2) / 2;
                const midY = wire.isFeedback ? 74 : (y1 + y2) / 2;

                return (
                  <g key={wire.id}>
                    {/* Soft Outer Glow Halo for Active Logic Nets */}
                    {isActive && !wire.isClockNet && (
                      <path
                        d={pathD}
                        fill="none"
                        stroke="#10B981"
                        strokeWidth={strokeWidth + 4}
                        opacity={0.18}
                      />
                    )}

                    {/* Base Trace */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={strokeWidth}
                      strokeDasharray={
                        wire.isClockNet ? '5 3' : wire.isFeedback ? '4 4' : undefined
                      }
                      opacity={isActive || wire.isClockNet ? 0.95 : 0.55}
                    />

                    {/* Active Signal Midpoint Probe Indicator */}
                    {isActive && !wire.isClockNet && !isBus && (
                      <circle cx={midX} cy={midY} r={3.5} fill="#34D399" />
                    )}

                    {/* Multi-bit Bus Slash Notation (e.g. / 8) */}
                    {isBus && (
                      <g transform={`translate(${midX}, ${midY})`}>
                        <line
                          x1="-5"
                          y1="6"
                          x2="5"
                          y2="-6"
                          stroke="#38BDF8"
                          strokeWidth="1.8"
                        />
                        <rect
                          x="-12"
                          y="-20"
                          width="24"
                          height="13"
                          rx="3"
                          fill="#0F172A"
                          stroke="#38BDF8"
                          strokeWidth="0.8"
                        />
                        <text
                          y="-11"
                          textAnchor="middle"
                          className="fill-sky-300 font-mono text-[9px] font-bold"
                        >
                          {wire.width}b
                        </text>
                      </g>
                    )}

                    {/* Solder Junction Dots */}
                    <circle cx={x1} cy={y1} r="3" fill={strokeColor} />
                    <circle cx={x2} cy={y2} r="3" fill={strokeColor} />
                  </g>
                );
              })}

              {/* Render Hardware Schematic Nodes (Ports, Logic Gates, Muxes, Flip-Flops) */}
              {circuit.nodes.map((node) => {
                const active = isNodeHigh(node);
                const isSelected = selectedNodeId === node.id;

                if (node.category === 'INPUT_PORT') {
                  const val = simState.signals[node.label] ?? 0;
                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      onClick={() => handleToggleInputPin(node.label, node.width)}
                      className="cursor-pointer group"
                    >
                      {/* Pentagonal IC Input Pad */}
                      <polygon
                        points="-56,-18 36,-18 54,0 36,18 -56,18"
                        fill={active ? '#064E3B' : '#0F172A'}
                        stroke={active ? '#10B981' : '#475569'}
                        strokeWidth={isSelected ? 2.5 : 1.8}
                      />
                      <text
                        x="-46"
                        y="-2"
                        className="fill-slate-100 font-mono text-[11px] font-bold"
                      >
                        {node.label}
                      </text>
                      <text
                        x="-46"
                        y="11"
                        className="fill-emerald-400 font-mono text-[9.5px] font-semibold"
                      >
                        {formatSignalValue(val, node.width)}
                      </text>
                    </g>
                  );
                }

                if (node.category === 'OUTPUT_PORT') {
                  const val = simState.signals[node.label] ?? 0;
                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      onClick={() => setSelectedNodeId(node.id)}
                      className="cursor-pointer"
                    >
                      {/* Pentagonal IC Output Pad */}
                      <polygon
                        points="-54,0 -36,-18 56,-18 56,18 -36,18"
                        fill={active ? '#083344' : '#0F172A'}
                        stroke={active ? '#06B6D4' : '#475569'}
                        strokeWidth={isSelected ? 2.5 : 1.8}
                      />
                      <text
                        x="-28"
                        y="-2"
                        className="fill-slate-100 font-mono text-[11px] font-bold"
                      >
                        {node.label}
                      </text>
                      <text
                        x="-28"
                        y="11"
                        className="fill-cyan-300 font-mono text-[9.5px] font-semibold"
                      >
                        {formatSignalValue(val, node.width)}
                      </text>
                    </g>
                  );
                }

                if (node.category === 'DFF' || node.category === 'MEMORY_ARRAY') {
                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      onClick={() => setSelectedNodeId(node.id)}
                      className="cursor-pointer"
                    >
                      <rect
                        x="-68"
                        y="-40"
                        width="136"
                        height="80"
                        rx="8"
                        fill="url(#dff-surface)"
                        stroke={isSelected ? '#38BDF8' : active ? '#10B981' : '#334155'}
                        strokeWidth={isSelected ? 2.5 : 1.8}
                      />
                      {/* Top Register Header Band */}
                      <rect
                        x="-68"
                        y="-40"
                        width="136"
                        height="17"
                        rx="6"
                        fill="rgba(56, 189, 248, 0.15)"
                      />
                      <text
                        x="0"
                        y="-28"
                        textAnchor="middle"
                        className="fill-cyan-300 font-mono text-[9.5px] font-bold"
                      >
                        {node.category === 'MEMORY_ARRAY' ? 'SRAM_BANK' : 'SYNC_DFF'}
                      </text>

                      {/* D and Q Pin Labels */}
                      <text x="-60" y="-8" className="fill-slate-400 font-mono text-[8.5px]">
                        D
                      </text>
                      <text x="53" y="-8" className="fill-slate-300 font-mono text-[8.5px] font-bold">
                        Q
                      </text>

                      {/* Register Name & Bit Width */}
                      <text
                        x="6"
                        y="-3"
                        textAnchor="middle"
                        className="fill-white font-mono text-[10.5px] font-bold"
                      >
                        {node.label}
                      </text>
                      <text
                        x="6"
                        y="10"
                        textAnchor="middle"
                        className="fill-slate-400 font-mono text-[8.5px]"
                      >
                        {node.sublabel}
                      </text>

                      {/* Clock Edge Triangle Symbol (>) at Bottom-Left */}
                      <polygon
                        points="-68,22 -58,27 -68,32"
                        fill="none"
                        stroke="#F59E0B"
                        strokeWidth="1.5"
                      />
                      <text x="-54" y="30" className="fill-amber-400 font-mono text-[8px]">
                        CLK
                      </text>
                    </g>
                  );
                }

                if (node.category === 'MUX' || node.category === 'DECODER_ARBITER') {
                  return (
                    <g
                      key={node.id}
                      transform={`translate(${node.x}, ${node.y})`}
                      onClick={() => setSelectedNodeId(node.id)}
                      className="cursor-pointer"
                    >
                      {/* Classic Trapezoid Multiplexer Shape */}
                      <polygon
                        points="-66,-36 66,-22 66,22 -66,36"
                        fill="url(#gate-surface)"
                        stroke={isSelected ? '#38BDF8' : active ? '#10B981' : '#475569'}
                        strokeWidth={isSelected ? 2.5 : 1.8}
                      />
                      <text
                        x="0"
                        y="-4"
                        textAnchor="middle"
                        className="fill-cyan-300 font-mono text-[11px] font-bold"
                      >
                        {node.label}
                      </text>
                      <text
                        x="0"
                        y="11"
                        textAnchor="middle"
                        className="fill-slate-400 font-mono text-[9px]"
                      >
                        {node.expression || node.sublabel}
                      </text>
                    </g>
                  );
                }

                // Combinational Logic Gate / Comparator / ALU Block
                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    onClick={() => setSelectedNodeId(node.id)}
                    className="cursor-pointer"
                  >
                    <rect
                      x="-68"
                      y="-30"
                      width="136"
                      height="60"
                      rx="10"
                      fill="url(#gate-surface)"
                      stroke={isSelected ? '#38BDF8' : active ? '#10B981' : '#475569'}
                      strokeWidth={isSelected ? 2.5 : 1.8}
                    />
                    <text
                      x="0"
                      y="-6"
                      textAnchor="middle"
                      className="fill-emerald-300 font-mono text-[11px] font-bold"
                    >
                      {node.label}
                    </text>
                    <text
                      x="0"
                      y="9"
                      textAnchor="middle"
                      className="fill-slate-300 font-mono text-[9.5px]"
                    >
                      {node.expression || node.sublabel}
                    </text>
                    <text
                      x="0"
                      y="22"
                      textAnchor="middle"
                      className="fill-slate-500 font-mono text-[8.5px]"
                    >
                      {node.sublabel}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Bottom Schematic Legend & Selected Node Inspector Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800/80 bg-slate-900/90 px-4 py-2 text-[11px] font-mono text-slate-400">
              <div className="flex flex-wrap items-center gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-4 rounded-xs bg-emerald-500"></span>
                  Logic HIGH (1)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-4 rounded-xs bg-slate-600"></span>
                  Logic LOW (0)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-0.5 w-4 border-t-2 border-dashed border-amber-400"></span>
                  Clock Net
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-4 rounded-xs bg-sky-400"></span>
                  Multi-Bit Bus
                </span>
              </div>

              {selectedNode ? (
                <div className="flex items-center gap-2 text-cyan-300">
                  <Zap className="h-3.5 w-3.5" />
                  <span>
                    Selected: <strong>{selectedNode.label}</strong> ({selectedNode.sublabel}) · Width:{' '}
                    {selectedNode.width}-bit
                  </span>
                </div>
              ) : (
                <span>Tip: Click any input pin on the diagram or top bar to inject live signals</span>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Live Digital Timing Waveform Analyzer (VCD Viewer) */}
        {activeTab === 'waveform' && (
          <div className="p-4 overflow-x-auto">
            <div className="min-w-[640px] space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 pb-2 border-b border-slate-800">
                <span>SIGNAL NAME / WIDTH</span>
                <div className="flex items-center gap-4">
                  <span>TIMEBASE: 10ns / CLK CYCLE</span>
                  {hoveredCycle !== null && (
                    <span className="text-cyan-400 font-semibold">
                      Cursor: Cycle #{hoveredCycle}
                    </span>
                  )}
                </div>
              </div>

              {circuit.ports.map((port) => {
                const isBus = port.width > 1;
                const latestVal = simState.signals[port.name] ?? 0;

                return (
                  <div
                    key={port.id}
                    className="grid grid-cols-12 items-center gap-2 py-1.5 border-b border-slate-900 hover:bg-slate-900/40 rounded px-2"
                  >
                    {/* Signal Label & Live Value */}
                    <div className="col-span-3 flex items-center justify-between pr-3 font-mono text-xs">
                      <div className="flex items-center gap-1.5 truncate">
                        <span
                          className={`text-[10px] px-1 rounded ${
                            port.direction === 'input'
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-cyan-500/15 text-cyan-400'
                          }`}
                        >
                          {port.direction === 'input' ? 'IN' : 'OUT'}
                        </span>
                        <span className="font-semibold text-slate-200 truncate">{port.name}</span>
                      </div>
                      <span className="text-slate-400 text-[11px] tabular-nums">
                        {formatSignalValue(latestVal, port.width)}
                      </span>
                    </div>

                    {/* SVG Timing Trace across History Cycles */}
                    <div className="col-span-9">
                      <svg viewBox="0 0 600 34" className="w-full h-8 overflow-visible">
                        {/* Vertical Cycle Grid Lines */}
                        {simState.history.map((h, i) => {
                          const x = i * (600 / Math.max(1, simState.history.length));
                          const cellW = 600 / Math.max(1, simState.history.length);
                          const val = h.values[port.name] ?? 0;
                          const prevVal =
                            i > 0 ? simState.history[i - 1].values[port.name] ?? 0 : val;

                          if (port.isClock) {
                            // Square wave clock signal (high first half, low second half)
                            const midX = x + cellW / 2;
                            return (
                              <g
                                key={h.cycle}
                                onMouseEnter={() => setHoveredCycle(h.cycle)}
                                onMouseLeave={() => setHoveredCycle(null)}
                              >
                                <line
                                  x1={x}
                                  y1={0}
                                  x2={x}
                                  y2={34}
                                  stroke="rgba(51,65,85,0.4)"
                                  strokeWidth="1"
                                />
                                <path
                                  d={`M ${x} 28 L ${x} 6 L ${midX} 6 L ${midX} 28 L ${
                                    x + cellW
                                  } 28`}
                                  fill="none"
                                  stroke="#F59E0B"
                                  strokeWidth="1.8"
                                />
                              </g>
                            );
                          }

                          if (isBus) {
                            // Hexadecimal Bus Envelope
                            return (
                              <g
                                key={h.cycle}
                                onMouseEnter={() => setHoveredCycle(h.cycle)}
                                onMouseLeave={() => setHoveredCycle(null)}
                              >
                                <polygon
                                  points={`${x},17 ${x + 5},6 ${x + cellW - 5},6 ${
                                    x + cellW
                                  },17 ${x + cellW - 5},28 ${x + 5},28`}
                                  fill="rgba(56, 189, 248, 0.14)"
                                  stroke="#38BDF8"
                                  strokeWidth="1.5"
                                />
                                <text
                                  x={x + cellW / 2}
                                  y="20"
                                  textAnchor="middle"
                                  className="fill-sky-200 font-mono text-[10px] font-semibold"
                                >
                                  0x{val.toString(16).toUpperCase()}
                                </text>
                              </g>
                            );
                          }

                          // Single-bit digital waveform trace
                          const yCurr = val > 0 ? 7 : 27;
                          const yPrev = prevVal > 0 ? 7 : 27;
                          const stroke =
                            port.direction === 'output' ? '#22D3EE' : '#10B981';

                          return (
                            <g
                              key={h.cycle}
                              onMouseEnter={() => setHoveredCycle(h.cycle)}
                              onMouseLeave={() => setHoveredCycle(null)}
                            >
                              <line
                                x1={x}
                                y1={0}
                                x2={x}
                                y2={34}
                                stroke="rgba(51,65,85,0.35)"
                                strokeWidth="1"
                              />
                              {val > 0 && (
                                <rect
                                  x={x}
                                  y={7}
                                  width={cellW}
                                  height={20}
                                  fill={
                                    port.direction === 'output'
                                      ? 'rgba(34, 211, 238, 0.14)'
                                      : 'rgba(16, 185, 129, 0.14)'
                                  }
                                />
                              )}
                              <path
                                d={`M ${x} ${yPrev} L ${x} ${yCurr} L ${x + cellW} ${yCurr}`}
                                fill="none"
                                stroke={stroke}
                                strokeWidth="2"
                              />
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: RTL Synthesis Architecture & Netlist Matrix */}
        {activeTab === 'netlist' && (
          <div className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Synthesized Cells
                </span>
                <p className="text-xl font-mono font-bold text-white tabular-nums mt-1">
                  {circuit.metrics.gateCount}{' '}
                  <span className="text-xs font-normal text-slate-400">BLOCKS</span>
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Sequential State
                </span>
                <p className="text-xl font-mono font-bold text-cyan-400 tabular-nums mt-1">
                  {circuit.metrics.flipFlopCount}{' '}
                  <span className="text-xs font-normal text-slate-400">REGISTERS</span>
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Logic Depth
                </span>
                <p className="text-xl font-mono font-bold text-emerald-400 tabular-nums mt-1">
                  {circuit.metrics.criticalPathStages}{' '}
                  <span className="text-xs font-normal text-slate-400">STAGES</span>
                </p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-3">
                <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                  Active Nets
                </span>
                <p className="text-xl font-mono font-bold text-amber-400 tabular-nums mt-1">
                  {circuit.wires.length}{' '}
                  <span className="text-xs font-normal text-slate-400">WIRES</span>
                </p>
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left border-collapse font-mono text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900 text-slate-400 text-[10px] uppercase">
                    <th className="py-2.5 px-3">Port / Register</th>
                    <th className="py-2.5 px-3">Direction / Type</th>
                    <th className="py-2.5 px-3">Bit Width</th>
                    <th className="py-2.5 px-3">Live Logic State</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {circuit.ports.map((p) => {
                    const val = simState.signals[p.name] ?? 0;
                    return (
                      <tr key={p.id} className="hover:bg-slate-900/40">
                        <td className="py-2 px-3 font-semibold text-slate-200">{p.name}</td>
                        <td className="py-2 px-3 text-slate-400">
                          {p.direction.toUpperCase()} {p.isReg ? '(reg)' : '(wire)'}
                        </td>
                        <td className="py-2 px-3 tabular-nums text-slate-300">{p.width}-bit</td>
                        <td className="py-2 px-3 tabular-nums text-cyan-400 font-semibold">
                          {formatSignalValue(val, p.width)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
