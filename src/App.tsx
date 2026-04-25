/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useMemo } from 'react';
import { 
  Wrench, 
  Droplets, 
  CheckCircle2, 
  Plus, 
  Hash,
  Trash2, 
  Car,
  Clock,
  Pencil,
  Check,
  X,
  RotateCcw,
  Printer,
  Settings,
  Eye,
  EyeOff,
  Sparkles,
  Camera,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import { useRef } from 'react';

// --- Types & Constants ---

type VehicleType = 'RAC' | 'TRUCK';
type VehicleStatus = 'OFICINA' | 'LIMPEZA' | 'LIMPEZA_ESPECIAL' | 'PRONTO';

interface Vehicle {
  id: string;
  plate: string;
  type: VehicleType;
  status: VehicleStatus;
  observations: string;
  createdAt: number;
}

const TYPE_CONFIG = {
  RAC: { label: 'RAC', color: 'bg-blue-600', text: 'text-blue-600' },
  TRUCK: { label: 'TRUCK', color: 'bg-orange-600', text: 'text-orange-600' }
};

const STATUS_CONFIG = {
  OFICINA: {
    label: 'Oficina',
    icon: Wrench,
    dot: 'bg-red-500',
    printColor: 'text-red-800'
  },
  LIMPEZA: {
    label: 'Limpeza',
    icon: Droplets,
    dot: 'bg-yellow-400',
    printColor: 'text-yellow-800'
  },
  LIMPEZA_ESPECIAL: {
    label: 'Limpeza Especial',
    icon: Sparkles,
    dot: 'bg-pink-500',
    printColor: 'text-pink-800'
  },
  PRONTO: {
    label: 'Pronto para Alugar',
    icon: CheckCircle2,
    dot: 'bg-emerald-500',
    printColor: 'text-emerald-800'
  }
};

// --- App Component ---

export default function App() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [filter, setFilter] = useState<VehicleStatus | 'TODOS'>('TODOS');
  const [plate, setPlate] = useState('');
  const [vehicleType, setVehicleType] = useState<VehicleType>('RAC');
  const [observations, setObservations] = useState('');
  const [status, setStatus] = useState<VehicleStatus>('PRONTO');
  const [initialRender, setInitialRender] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Scanner States
  const [isScanning, setIsScanning] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // States for editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPlate, setEditPlate] = useState('');
  const [editObservations, setEditObservations] = useState('');

  // Load from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('fleet_data');
    if (saved) {
      try {
        setVehicles(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse fleet data', e);
      }
    }
    setInitialRender(false);
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (!initialRender) {
      localStorage.setItem('fleet_data', JSON.stringify(vehicles));
    }
  }, [vehicles, initialRender]);

  const addVehicle = () => {
    if (!plate.trim()) return;

    const formattedPlate = plate.toUpperCase().trim();
    
    // Duplicate check
    if (vehicles.some(v => v.plate === formattedPlate)) {
      setErrorMsg(`A matrícula ${formattedPlate} já existe na frota!`);
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }

    const newVehicle: Vehicle = {
      id: crypto.randomUUID(),
      plate: formattedPlate,
      type: vehicleType,
      status,
      observations: observations.trim(),
      createdAt: Date.now(),
    };

    setVehicles([newVehicle, ...vehicles]);
    setPlate('');
    setObservations('');
    setIsMobileMenuOpen(false);
    setErrorMsg(null);
  };

  const updateStatus = (id: string, newStatus: VehicleStatus) => {
    setVehicles(vehicles.map(v => v.id === id ? { ...v, status: newStatus } : v));
  };

  const startEditing = (vehicle: Vehicle) => {
    setEditingId(vehicle.id);
    setEditPlate(vehicle.plate);
    setEditObservations(vehicle.observations);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditPlate('');
    setEditObservations('');
  };

  const saveEdit = () => {
    if (!editPlate.trim() || !editingId) return;
    
    const formattedPlate = editPlate.toUpperCase().trim();

    // Duplicate check (excluding current vehicle)
    if (vehicles.some(v => v.plate === formattedPlate && v.id !== editingId)) {
      setErrorMsg(`A matrícula ${formattedPlate} já está sendo usada por outro veículo!`);
      setTimeout(() => setErrorMsg(null), 4000);
      return;
    }

    setVehicles(vehicles.map(v => 
      v.id === editingId 
        ? { ...v, plate: formattedPlate, observations: editObservations.trim() } 
        : v
    ));
    cancelEditing();
    setErrorMsg(null);
  };

  const resetFleet = () => {
    if (confirm('🚨 TENS A CERTEZA? Isto irá APAGAR TODA A FROTA e limpar todos os dados lançados.')) {
      setVehicles([]);
      setIsMobileMenuOpen(false);
    }
  };

  const deleteVehicle = (id: string) => {
    if (confirm('Tem certeza que deseja remover este veículo?')) {
      setVehicles(vehicles.filter(v => v.id !== id));
    }
  };

  const startScanner = async () => {
    setIsScanning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setErrorMsg("Erro ao aceder à câmara.");
      setIsScanning(false);
    }
  };

  const stopScanner = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsScanning(false);
    setIsProcessing(false);
  };

  const captureAndScan = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    setIsProcessing(true);
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    const imageData = canvas.toDataURL('image/jpeg', 0.8).split(',')[1];
    
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const prompt = "Extract only the license plate alphanumeric characters from this image. Return just the plate number in uppercase without any extra text or spaces. If not found, return 'NOT_FOUND'.";
      
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: imageData,
                mimeType: "image/jpeg"
              }
            }
          ]
        }
      });
      
      const text = response.text?.trim() || 'NOT_FOUND';
      if (text !== 'NOT_FOUND' && text.length > 2) {
        setPlate(text.toUpperCase());
        stopScanner();
      } else {
        setErrorMsg("Não foi possível identificar a matrícula. Tente novamente.");
        setIsProcessing(false);
        setTimeout(() => setErrorMsg(null), 3000);
      }
    } catch (err) {
      console.error("AI scanning error:", err);
      setErrorMsg("Erro no processamento da imagem.");
      setIsProcessing(false);
    }
  };

  const filteredVehicles = useMemo(() => {
    if (filter === 'TODOS') return vehicles;
    return vehicles.filter(v => v.status === filter);
  }, [vehicles, filter]);

  const stats = {
    TODOS: vehicles.length,
    OFICINA: vehicles.filter(v => v.status === 'OFICINA').length,
    LIMPEZA: vehicles.filter(v => v.status === 'LIMPEZA').length,
    LIMPEZA_ESPECIAL: vehicles.filter(v => v.status === 'LIMPEZA_ESPECIAL').length,
    PRONTO: vehicles.filter(v => v.status === 'PRONTO').length,
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-green-50 text-emerald-950 font-sans flex flex-col md:flex-row md:overflow-hidden">
      {/* Sidebar: Management & Registration */}
      <aside className="w-full md:w-80 bg-emerald-900 text-white flex flex-col shrink-0 md:h-screen sticky top-0 z-30 shadow-2xl print:hidden">
        <div className="p-6 md:p-8 flex items-center justify-between md:block">
          <div>
            <h1 className="text-4xl md:text-6xl font-black italic tracking-tighter text-yellow-400 mb-0 md:mb-2 drop-shadow-md leading-tight">FLEET REPORT PRIOR VELHO</h1>
            <p className="text-[8px] md:text-[10px] uppercase tracking-[0.3em] font-bold text-emerald-300">Gestão de Frotas v2.4</p>
          </div>
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="md:hidden bg-emerald-800 p-3 rounded-sm border border-emerald-700 active:scale-95 transition-all text-yellow-400 flex items-center justify-center min-w-[44px] min-h-[44px]"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Plus size={24} />}
          </button>
        </div>

        {/* Management Controls */}
        <div className={`flex-1 flex flex-col md:flex space-y-6 overflow-y-auto custom-scrollbar px-6 md:px-8 py-4 border-t border-emerald-800 md:border-none ${isMobileMenuOpen ? 'flex' : 'hidden'}`}>
          <div className="space-y-4">
            <div>
              <label className="text-[10px] uppercase tracking-widest font-black text-emerald-300 block mb-2 leading-none">Segmento</label>
              <div className="grid grid-cols-2 gap-2">
                {(['RAC', 'TRUCK'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setVehicleType(t)}
                    className={`py-3 rounded font-black text-xs transition-all ${
                      vehicleType === t 
                        ? (t === 'RAC' ? 'bg-blue-600 text-white shadow-lg' : 'bg-orange-600 text-white shadow-lg') 
                        : 'bg-emerald-800/50 text-emerald-400 border border-emerald-700'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-widest font-black text-yellow-400 mb-2 block">Novo Veículo</label>
              <div className="relative flex gap-2">
                <div className="relative flex-1">
                  <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-300" size={16} />
                  <input 
                    type="text" 
                    placeholder="MATRÍCULA" 
                    className={`w-full bg-emerald-800 border-2 ${errorMsg && plate ? 'border-red-500 animate-shake' : 'border-emerald-700 focus:border-yellow-400'} p-4 pl-10 text-2xl font-mono font-black uppercase transition-all outline-none rounded-sm placeholder:text-emerald-700 placeholder:normal-case placeholder:font-sans placeholder:font-normal text-white`}
                    value={plate}
                    onChange={(e) => {
                      setPlate(e.target.value.toUpperCase());
                      setErrorMsg(null);
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && addVehicle()}
                  />
                </div>
                <button 
                  onClick={startScanner}
                  className="bg-emerald-800 border-2 border-emerald-700 hover:border-yellow-400 text-emerald-300 hover:text-yellow-400 p-4 rounded-sm transition-all flex items-center justify-center shrink-0 active:scale-95"
                  title="Escanear Matrícula"
                >
                  <Camera size={24} />
                </button>
              </div>
              <AnimatePresence>
                {errorMsg && !editingId && (
                  <motion.p 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-[10px] text-red-400 font-bold mt-2 uppercase tracking-tight flex items-center gap-1"
                  >
                    <X size={12} strokeWidth={3} className="bg-red-500 text-emerald-950 rounded-full" />
                    {errorMsg}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-widest font-black text-emerald-300 mb-2 block">Estado Atual</label>
              <div className="grid grid-cols-1 gap-2">
                {(Object.keys(STATUS_CONFIG) as VehicleStatus[]).map((s) => {
                  const config = STATUS_CONFIG[s];
                  const isActive = status === s;
                  return (
                    <button
                      key={s}
                      onClick={() => setStatus(s)}
                      className={`flex items-center gap-3 p-3 rounded transition-all text-left font-bold text-sm ${
                        isActive 
                          ? 'bg-yellow-400 text-emerald-900 scale-105 shadow-lg' 
                          : 'bg-emerald-800 text-emerald-300 hover:bg-emerald-700'
                      }`}
                    >
                      <span className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-emerald-900 animate-pulse' : config.dot}`} />
                      {config.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="text-[10px] uppercase tracking-widest font-black text-emerald-300 mb-2 block">Observações</label>
              <textarea 
                className="w-full bg-emerald-800 border-2 border-emerald-700 focus:border-yellow-400 transition-all p-4 text-sm h-28 resize-none rounded-sm outline-none placeholder:text-emerald-700 text-white" 
                placeholder="Ex: Troca de óleo pendente..."
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
              />
            </div>

            <button 
              onClick={addVehicle}
              className="w-full bg-yellow-400 text-emerald-900 font-black py-4 rounded shadow-lg shadow-emerald-950/20 active:scale-95 transition-transform hover:bg-yellow-300 uppercase tracking-widest"
            >
              ADICIONAR VEÍCULO (⏎)
            </button>

            {/* Zerar Frota Mobile */}
            <button 
              onClick={resetFleet}
              className="w-full flex md:hidden items-center justify-center gap-2 border-2 border-red-500/30 text-red-400 hover:bg-red-500 hover:text-white py-3 text-[10px] font-black tracking-widest uppercase transition-all rounded-sm mt-4"
            >
              <RotateCcw size={14} />
              Zerar Frota
            </button>
          </div>
        </div>

        {/* Global Actions (Desktop) */}
        <div className="hidden md:flex flex-col gap-2 p-8 bg-emerald-950/50 border-t border-emerald-800">
          <button 
            onClick={handlePrint}
            className="w-full border-2 border-white/20 hover:border-white hover:bg-white/10 py-3 text-xs font-black tracking-widest uppercase transition-all"
          >
            Imprimir Relatório
          </button>
          
          <button 
            onClick={resetFleet}
            className="w-full flex items-center justify-center gap-2 border-2 border-red-500/30 text-red-500/70 hover:border-red-500 hover:bg-red-500 hover:text-white py-3 text-[10px] font-black tracking-widest uppercase transition-all"
          >
            <RotateCcw size={14} />
            Zerar Frota
          </button>
        </div>
      </aside>

      {/* Main Content: Dashboard */}
      <div className="flex-1 flex flex-col md:h-screen overflow-hidden print:hidden">
        {/* Dynamic Counters */}
        <div className="grid grid-cols-2 md:grid-cols-5 bg-white border-b-4 border-emerald-900 shrink-0 print:hidden">
          <div className="p-4 md:p-8 border-r border-b md:border-b-0 border-green-100 group hover:bg-emerald-50 transition-colors">
            <span className="text-[8px] md:text-[10px] uppercase font-black text-emerald-600 block mb-1 tracking-widest">Total Frota</span>
            <span className="text-3xl md:text-6xl font-black tracking-tighter">{stats.TODOS}</span>
          </div>
          <div className="p-4 md:p-8 border-r border-b md:border-b-0 border-green-100 bg-green-50 group hover:bg-green-100 transition-colors text-green-600">
            <span className="text-[8px] md:text-[10px] uppercase font-black text-emerald-600 block mb-1 tracking-widest">✅ Pronto</span>
            <span className="text-3xl md:text-6xl font-black tracking-tighter">{stats.PRONTO}</span>
          </div>
          <div className="p-4 md:p-8 border-r border-b md:border-b-0 border-green-100 group hover:bg-yellow-50 transition-colors text-yellow-500">
            <span className="text-[8px] md:text-[10px] uppercase font-black text-yellow-600 block mb-1 tracking-widest">🫧 Limpeza</span>
            <span className="text-3xl md:text-6xl font-black tracking-tighter">{stats.LIMPEZA}</span>
          </div>
          <div className="p-4 md:p-8 border-r border-green-100 group hover:bg-pink-50 transition-colors text-pink-500">
            <span className="text-[8px] md:text-[10px] uppercase font-black text-pink-600 block mb-1 tracking-widest">✨ Especial</span>
            <span className="text-3xl md:text-6xl font-black tracking-tighter">{stats.LIMPEZA_ESPECIAL}</span>
          </div>
          <div className="p-4 md:p-8 group hover:bg-red-50 transition-colors text-red-600">
            <span className="text-[8px] md:text-[10px] uppercase font-black text-red-600 block mb-1 tracking-widest">🔧 Oficina</span>
            <span className="text-3xl md:text-6xl font-black tracking-tighter">{stats.OFICINA}</span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="px-4 md:px-8 py-3 md:py-4 bg-emerald-50 border-b border-emerald-100 flex flex-col md:flex-row items-center justify-between shrink-0 print:hidden gap-3">
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
            {(['TODOS', 'OFICINA', 'LIMPEZA', 'LIMPEZA_ESPECIAL', 'PRONTO'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-4 md:px-6 py-3 md:py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap min-h-[40px] flex items-center ${
                  filter === f 
                    ? 'bg-emerald-900 text-white shadow-md' 
                    : 'border border-emerald-200 text-emerald-700 hover:bg-white bg-white/50'
                }`}
              >
                {f === 'TODOS' ? 'Todos' : STATUS_CONFIG[f as VehicleStatus].label}
                <span className="ml-2 opacity-50">{stats[f]}</span>
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 md:gap-4 shrink-0">
            <div className="hidden sm:flex items-center gap-2 text-[8px] md:text-[10px] font-bold text-emerald-400 uppercase tracking-tighter italic whitespace-nowrap">
              <Clock size={12} strokeWidth={3} /> Dados Locais • Atualizado agora
            </div>
            
            <button 
              onClick={resetFleet}
              className="bg-white p-2 md:p-2.5 rounded-full border border-red-100 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-sm active:scale-95 flex items-center gap-2"
              title="Zerar Matrículas"
            >
              <RotateCcw size={16} strokeWidth={2.5} />
              <span className="text-[10px] font-black uppercase tracking-tight hidden md:inline">Zerar</span>
            </button>

            <button 
              onClick={handlePrint}
              className="bg-white p-2 md:p-2.5 rounded-full border border-emerald-100 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all shadow-sm active:scale-95 flex items-center gap-2"
              title="Imprimir Relatório"
            >
              <Printer size={16} strokeWidth={2.5} />
              <span className="text-[10px] font-black uppercase tracking-tight hidden md:inline">Imprimir</span>
            </button>
          </div>
        </div>

        {/* Grid Content */}
        <div className="p-4 md:p-8 overflow-y-auto flex-1 custom-scrollbar print:hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4 md:gap-6 content-start">
            <AnimatePresence mode="popLayout">
              {filteredVehicles.length === 0 ? (
                <div className="col-span-full py-20 flex flex-col items-center justify-center text-emerald-200 grayscale opacity-50 print:hidden">
                   <Car size={64} strokeWidth={1} />
                   <p className="mt-4 font-black uppercase tracking-widest">Nenhum veículo registado</p>
                </div>
              ) : (
                filteredVehicles.map((vehicle) => {
                  const isEditing = editingId === vehicle.id;
                  return (
                    <motion.div
                      layout
                      key={vehicle.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className={`bg-white border-l-[12px] p-4 md:p-6 flex items-start gap-4 md:gap-6 shadow-sm group hover:shadow-xl transition-all avoid-break print:shadow-none print:border-b print:mb-4 ${
                        vehicle.status === 'PRONTO' ? 'border-emerald-500' :
                        vehicle.status === 'LIMPEZA' ? 'border-yellow-400' : 
                        vehicle.status === 'LIMPEZA_ESPECIAL' ? 'border-pink-400' : 'border-red-500'
                      } ${isEditing ? 'ring-2 ring-yellow-400 shadow-2xl z-10' : ''}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-3 gap-2">
                          {isEditing ? (
                            <div className="flex-1">
                              <input 
                                autoFocus
                                className={`text-2xl md:text-3xl font-mono font-black tracking-tighter text-emerald-950 bg-emerald-50 border-b-2 ${errorMsg ? 'border-red-500' : 'border-yellow-400'} outline-none w-full px-1`}
                                value={editPlate}
                                onChange={(e) => {
                                  setEditPlate(e.target.value.toUpperCase());
                                  setErrorMsg(null);
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEdit();
                                  if (e.key === 'Escape') cancelEditing();
                                }}
                              />
                              {errorMsg && (
                                <p className="text-[8px] text-red-500 font-black uppercase tracking-tight mt-1">
                                  {errorMsg}
                                </p>
                              )}
                            </div>
                          ) : (
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="text-2xl md:text-3xl font-mono font-black tracking-tighter text-emerald-950 truncate block leading-none">{vehicle.plate}</span>
                                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-black text-white ${TYPE_CONFIG[vehicle.type].color}`}>
                                    {vehicle.type}
                                  </span>
                                </div>
                                <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest mt-1 block">
                                  Lançado em {new Date(vehicle.createdAt).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                          )}
                          <div className="flex gap-1 shrink-0">
                            {isEditing ? (
                              <div className="flex gap-1">
                                <button
                                  onClick={saveEdit}
                                  className="p-3 md:p-2 rounded-sm bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-md flex items-center justify-center"
                                  title="Guardar"
                                >
                                  <Check size={18} className="md:w-4 md:h-4" strokeWidth={3} />
                                </button>
                                <button
                                  onClick={cancelEditing}
                                  className="p-3 md:p-2 rounded-sm bg-red-100 text-red-600 hover:bg-red-200 transition-all shadow-md flex items-center justify-center"
                                  title="Cancelar"
                                >
                                  <X size={18} className="md:w-4 md:h-4" strokeWidth={3} />
                                </button>
                              </div>
                            ) : (
                              (Object.keys(STATUS_CONFIG) as VehicleStatus[]).map((s) => (
                                <button
                                  key={s}
                                  onClick={() => updateStatus(vehicle.id, s)}
                                  title={STATUS_CONFIG[s].label}
                                  className={`p-1.5 md:p-2 rounded-sm border transition-all ${
                                    vehicle.status === s 
                                      ? 'bg-emerald-900 border-emerald-900 text-yellow-400 shadow-md'
                                      : 'bg-emerald-50 border-emerald-50 text-emerald-300 hover:text-emerald-900'
                                  }`}
                                >
                                  {(() => {
                                    const Icon = STATUS_CONFIG[s].icon;
                                    return <Icon className="w-3.5 h-3.5 md:w-4 md:h-4" strokeWidth={3} />;
                                  })()}
                                </button>
                              ))
                            )}
                          </div>
                        </div>

                        {isEditing ? (
                          <textarea 
                            className="w-full text-xs text-emerald-800 leading-relaxed font-medium bg-emerald-50 p-3 rounded italic border-2 border-emerald-100 focus:border-yellow-400 outline-none h-20 resize-none"
                            value={editObservations}
                            onChange={(e) => setEditObservations(e.target.value)}
                            placeholder="Motivo / Observações..."
                          />
                        ) : (
                          <p className="text-xs text-emerald-800 leading-relaxed font-medium bg-emerald-50/50 p-3 rounded italic group-hover:bg-emerald-50 transition-colors break-words">
                            {vehicle.observations || "Sem observações registadas."}
                          </p>
                        )}

                        <div className="mt-4 flex items-center justify-between gap-2 overflow-hidden">
                          <span className={`px-2 py-1 text-[9px] font-black uppercase rounded tracking-widest whitespace-nowrap ${
                            vehicle.status === 'PRONTO' ? 'bg-emerald-100 text-emerald-700' :
                            vehicle.status === 'LIMPEZA' ? 'bg-yellow-100 text-yellow-700' : 
                            vehicle.status === 'LIMPEZA_ESPECIAL' ? 'bg-pink-100 text-pink-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {STATUS_CONFIG[vehicle.status].label}
                          </span>
                          
                          {!isEditing && (
                            <div className="flex gap-2 md:gap-3 items-center">
                              <button 
                                onClick={() => startEditing(vehicle)}
                                className="text-emerald-300 hover:text-yellow-500 transition-colors flex items-center gap-1 text-[10px] uppercase font-black tracking-widest whitespace-nowrap"
                              >
                                <Pencil size={14} />
                                <span className="hidden sm:inline">Editar</span>
                              </button>
                              <button 
                                onClick={() => deleteVehicle(vehicle.id)}
                                className="text-emerald-200 hover:text-red-500 transition-colors p-1"
                                title="Remover Veículo"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>

            {/* Ghost Slot Placeholder */}
            <button 
              onClick={() => document.querySelector('input')?.focus()}
              className="bg-emerald-100/10 border-4 border-dashed border-emerald-200 p-6 flex flex-col items-center justify-center text-emerald-300 group hover:bg-emerald-100/30 hover:border-emerald-300 transition-all cursor-pointer h-full min-h-[160px] rounded-lg"
            >
              <Plus className="w-10 h-10 mb-2 group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Adicionar Novo Slot</span>
            </button>
          </div>
        </div>

        {/* Bottom Status Bar */}
        <footer className="hidden md:flex bg-white px-8 py-3 border-t-2 border-emerald-900 items-center gap-6 shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.6)]"></div>
            <span className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">SISTEMA OPERATIVO</span>
          </div>
          <div className="text-[10px] font-bold text-emerald-400 italic">
            Monitorização em tempo real ativo • {new Date().toLocaleDateString('pt-PT')}
          </div>
          <div className="ml-auto text-[10px] font-black text-emerald-900 bg-yellow-400 px-4 py-1.5 skew-x-[-12deg]">
            <span className="inline-block skew-x-[12deg]">USER: ADMIN_FLEET_ROOT</span>
          </div>
        </footer>
      </div>

      {/* --- PRINT VIEW --- */}
      <div className="hidden print:block absolute inset-0 bg-white p-12 overflow-visible">
        <header className="border-b-[10px] border-emerald-900 pb-6 mb-8 flex justify-between items-end">
           <div>
              <h1 className="text-7xl font-black italic tracking-tighter text-emerald-950 uppercase">Fleet Report Prior Velho</h1>
              <p className="text-xs font-black uppercase tracking-[0.5em] text-emerald-500 mt-2">Relatório Estrutural de Frota</p>
           </div>
           <div className="text-right font-black uppercase text-[10px] tracking-widest leading-loose">
              <p>Data: {new Date().toLocaleDateString('pt-PT')}</p>
              <p>Hora: {new Date().toLocaleTimeString('pt-PT')}</p>
              <p className="bg-emerald-950 text-white px-2 py-1 mt-1">SISTEMA_LOCAL_SYNC</p>
           </div>
        </header>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-12">
          <div className="border-[4px] border-emerald-950 p-6 text-center">
            <span className="text-[10px] font-black uppercase block mb-1 text-emerald-950">Total Geral</span>
            <span className="text-4xl font-black">{stats.TODOS}</span>
          </div>
          <div className="border-[4px] border-emerald-500 bg-emerald-50 p-6 text-center">
            <span className="text-[10px] font-black uppercase block mb-1 text-emerald-600">Prontos</span>
            <span className="text-4xl font-black text-emerald-600">{stats.PRONTO}</span>
          </div>
          <div className="border-[4px] border-yellow-400 bg-yellow-50 p-6 text-center">
            <span className="text-[10px] font-black uppercase block mb-1 text-yellow-600">Limpeza</span>
            <span className="text-4xl font-black text-yellow-600">{stats.LIMPEZA}</span>
          </div>
          <div className="border-[4px] border-pink-500 bg-pink-50 p-6 text-center">
            <span className="text-[10px] font-black uppercase block mb-1 text-pink-600">Especial</span>
            <span className="text-4xl font-black text-pink-600">{stats.LIMPEZA_ESPECIAL}</span>
          </div>
          <div className="border-[4px] border-red-500 bg-red-50 p-6 text-center">
            <span className="text-[10px] font-black uppercase block mb-1 text-red-600">Oficina</span>
            <span className="text-4xl font-black text-red-600">{stats.OFICINA}</span>
          </div>
        </div>

        {/* Print Layout */}
        <div className="space-y-12">
          {(['RAC', 'TRUCK'] as const).map((type) => {
            const typeVehicles = vehicles.filter(v => v.type === type);
            if (typeVehicles.length === 0) return null;

            return (
              <div key={type} className="avoid-break pt-8">
                <div className={`border-b-8 mb-8 pb-2 flex justify-between items-end ${type === 'RAC' ? 'border-blue-600' : 'border-orange-600'}`}>
                  <h2 className={`text-6xl font-black italic tracking-tighter uppercase ${type === 'RAC' ? 'text-blue-900' : 'text-orange-900'}`}>
                    Segmento {type}
                  </h2>
                  <span className="text-xl font-black opacity-30 italic">{typeVehicles.length} Veículos</span>
                </div>

                {(['OFICINA', 'LIMPEZA', 'LIMPEZA_ESPECIAL', 'PRONTO'] as VehicleStatus[]).map((s) => {
                  const categoryVehicles = typeVehicles.filter(v => v.status === s);
                  if (categoryVehicles.length === 0) return null;

                  return (
                    <section key={s} className="mb-10 avoid-break">
                      <h2 className={`text-xl font-black uppercase border-b-[3px] border-emerald-900 mb-4 pb-1 italic tracking-tighter ${STATUS_CONFIG[s].printColor}`}>
                        {STATUS_CONFIG[s].label} <small className="text-xs font-normal opacity-50 ml-2">({categoryVehicles.length} unidades)</small>
                      </h2>
                      <div className="overflow-hidden border border-emerald-900">
                        <table className="w-full border-collapse">
                          <thead>
                            <tr className="bg-emerald-900 text-white">
                              <th className="border border-emerald-800 py-2 px-3 font-black uppercase text-[9px] tracking-widest w-32">Matrícula</th>
                              <th className="border border-emerald-800 py-2 px-3 font-black uppercase text-[9px] tracking-widest w-32">Estado</th>
                              <th className="border border-emerald-800 py-2 px-3 font-black uppercase text-[9px] tracking-widest">Informações / Notas</th>
                              <th className="border border-emerald-800 py-2 px-3 font-black uppercase text-[9px] tracking-widest w-36">Data Lançamento</th>
                            </tr>
                          </thead>
                          <tbody>
                            {categoryVehicles.map((v, i) => (
                              <tr key={v.id} className={i % 2 === 0 ? 'bg-white' : 'bg-emerald-50/20'}>
                                <td className="border border-emerald-100 py-2 px-3 font-black font-mono text-lg text-emerald-950">{v.plate}</td>
                                <td className="border border-emerald-100 py-2 px-3 text-[9px] font-bold uppercase text-emerald-800">
                                  {STATUS_CONFIG[v.status].label}
                                </td>
                                <td className="border border-emerald-100 py-2 px-3 text-[9px] font-medium text-emerald-900 leading-tight">
                                  {v.observations || '-'}
                                </td>
                                <td className="border border-emerald-100 py-2 px-3 text-[9px] font-mono text-emerald-400">
                                  {new Date(v.createdAt).toLocaleString('pt-PT')}
                                </td>
                              </tr>
                            ))}
                            {/* Empty rows to simulate Excel grid if few vehicles (optional but gives the look) */}
                            {categoryVehicles.length < 5 && Array.from({ length: 5 - categoryVehicles.length }).map((_, i) => (
                              <tr key={`empty-${i}`} className="h-8">
                                <td className="border border-emerald-50"></td>
                                <td className="border border-emerald-50"></td>
                                <td className="border border-emerald-50"></td>
                                <td className="border border-emerald-50"></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  );
                })}
              </div>
            );
          })}
        </div>

        <footer className="mt-20 pt-10 border-t-2 border-emerald-100 text-center">
           <p className="text-[10px] font-black uppercase tracking-[0.8em] text-emerald-200 mb-2">Fleet Management Digital Signature</p>
           <p className="text-[8px] font-mono text-emerald-300">SYSTEM_GEN_KEY: {crypto.randomUUID().toUpperCase()}</p>
        </footer>
      </div>

      {/* --- SCANNER OVERLAY --- */}
      <AnimatePresence>
        {isScanning && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-emerald-950 flex flex-col items-center justify-center p-6"
          >
            <div className="relative w-full max-w-lg aspect-video md:aspect-[4/3] bg-black rounded-lg overflow-hidden border-4 border-emerald-800 shadow-2xl">
              <video 
                ref={videoRef} 
                className="w-full h-full object-cover"
                playsInline
                muted
              />
              <div className="absolute inset-0 border-[40px] border-black/40 pointer-events-none">
                <div className="w-full h-full border-2 border-yellow-400 relative">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[2px] bg-yellow-400/50 animate-[scan_2s_linear_infinite]" />
                </div>
              </div>

              {isProcessing && (
                <div className="absolute inset-0 bg-emerald-950/80 flex flex-col items-center justify-center text-white backdrop-blur-sm">
                  <Loader2 className="w-12 h-12 text-yellow-400 animate-spin mb-4" />
                  <p className="font-black uppercase tracking-widest text-xs">A processar imagem...</p>
                </div>
              )}
            </div>

            <p className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.3em] mt-8 text-center px-4">
              Aponte a câmara para a matrícula da viatura
            </p>

            <div className="flex gap-4 mt-8 w-full max-w-sm">
              <button 
                onClick={stopScanner}
                disabled={isProcessing}
                className="flex-1 bg-emerald-800 text-white font-black py-4 rounded uppercase tracking-widest text-xs border border-emerald-700 active:scale-95 transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button 
                onClick={captureAndScan}
                disabled={isProcessing}
                className="flex-1 bg-yellow-400 text-emerald-950 font-black py-4 rounded uppercase tracking-widest text-xs shadow-lg shadow-yellow-400/20 active:scale-95 transition-all disabled:opacity-50"
              >
                Capturar
              </button>
            </div>

            <canvas ref={canvasRef} className="hidden" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
