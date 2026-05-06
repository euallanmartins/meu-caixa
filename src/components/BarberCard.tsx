/* eslint-disable */
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { User, Scissors, DollarSign, CreditCard, Banknote, Sparkles, ChevronDown, ChevronUp, Check, Package, Settings, Trash2, AlertCircle } from 'lucide-react';

interface BarberProps {
  barber: {
    id: string;
    nome: string;
    comissao: number;
    comissao_tipo: 'percentual' | 'fixo';
    ativo?: boolean;
    foto_url?: string | null;
    titulo?: string | null;
    especialidade?: string | null;
    tags?: string[] | null;
    destaque_label?: string | null;
  };
  barbeariaId: string;
  onSuccess: () => void;
  onEdit: (barber: any) => void;
}

export function BarberCard({ barber, barbeariaId, onSuccess, onEdit }: BarberProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [mode, setMode] = useState<'service' | 'product'>('service');
  const [loading, setLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  
  // Form State
  const [serviceName, setServiceName] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'dinheiro' | 'cartao' | 'pix'>('dinheiro');
  const [tip, setTip] = useState('');

  // Split Payment State
  const [isSplit, setIsSplit] = useState(false);
  const [paymentMethod2, setPaymentMethod2] = useState<'dinheiro' | 'cartao' | 'pix'>('pix');
  const [amount1, setAmount1] = useState('');
  const [amount2, setAmount2] = useState('');

  // Product Selection State
  const [availableProducts, setAvailableProducts] = useState<any[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('1');

  async function fetchProducts() {
     const { data } = await supabase.from('produtos').select('*').eq('barbearia_id', barbeariaId).gt('estoque', 0);
     setAvailableProducts(data || []);
  }

  useEffect(() => {
     if (isExpanded && mode === 'product') {
        fetchProducts();
     }
  }, [isExpanded, mode]);

  // Math logic
  const serviceValue = parseFloat(amount || '0');
  const tipValue = parseFloat(tip || '0');
  
  // Auto-calculate split amounts
  useEffect(() => {
    if (isSplit && serviceValue > 0) {
      if (!amount1) {
        setAmount1((serviceValue / 2).toString());
        setAmount2((serviceValue / 2).toString());
      }
    }
  }, [isSplit, serviceValue]);

  const commissionValue = barber.comissao_tipo === 'percentual' 
    ? (serviceValue * (barber.comissao / 100))
    : (serviceValue > 0 ? barber.comissao : 0);
    
  const barbeariaProfit = serviceValue - commissionValue;

  // Selected Product Math
  const selectedProduct = availableProducts.find(p => p.id === selectedProductId);
  const productPrice = selectedProduct?.valor_venda || 0;
  const productQty = parseInt(quantity) || 0;
  const productTotal = productPrice * productQty;
  const productCommission = selectedProduct 
     ? (selectedProduct.comissao_tipo === 'percentual' 
        ? (productTotal * (selectedProduct.comissao_valor / 100))
        : (selectedProduct.comissao_valor * productQty))
     : 0;

  async function handleAddService() {
    if (mode === 'service') {
      if (!serviceValue || loading) return;
      setLoading(true);

      try {
        const today = new Date().toISOString();

        // 1. Get or create Service
        const { data: servico } = await supabase.from('servicos')
          .select('id').eq('barbearia_id', barbeariaId).eq('nome', serviceName).limit(1).maybeSingle();
        
        let servicoId = servico?.id;
        if (!servicoId) {
          const { data: newServ } = await supabase.from('servicos').insert({
            barbearia_id: barbeariaId,
            nome: serviceName || 'Serviço Avulso',
            valor: serviceValue
          }).select().single();
          servicoId = newServ?.id;
        }

        // 2. Create Transaction
        const { data: txData, error: txErr } = await supabase.from('transacoes').insert({
          barbearia_id: barbeariaId,
          barbeiro_id: barber.id,
          servico_id: servicoId,
          valor_total: serviceValue,
          data: today
        }).select().single();

        if (txErr) throw txErr;

        // 3. Payment details
        if (isSplit) {
          const v1 = parseFloat(amount1 || '0');
          const v2 = parseFloat(amount2 || '0');
          
          await supabase.from('transacao_pagamentos').insert([
            { transacao_id: txData.id, metodo: paymentMethod, valor: v1 },
            { transacao_id: txData.id, metodo: paymentMethod2, valor: v2 }
          ]);
        } else {
          await supabase.from('transacao_pagamentos').insert({
            transacao_id: txData.id,
            metodo: paymentMethod,
            valor: serviceValue
          });
        }

        // 4. Tip (if exists)
        if (tipValue > 0) {
          await supabase.from('caixinhas').insert({
            barbearia_id: barbeariaId,
            barbeiro_id: barber.id,
            valor: tipValue,
            metodo: isSplit ? 'dinheiro' : paymentMethod, // Default to cash for split tips or main method
            data: today
          });
        }

        resetForm();
        onSuccess();
      } catch (err: any) {
        alert('Erro ao salvar: ' + err.message);
      } finally {
        setLoading(false);
      }
    } else {
      // PRODUCT SALE LOGIC
      if (!selectedProductId || loading) return;
      setLoading(true);
      try {
        const product = availableProducts.find(p => p.id === selectedProductId);
        if (!product) return;

        const today = new Date().toISOString();

        // Create transaction for product sale
        const { data: txData, error: txErr } = await supabase.from('transacoes').insert({
          barbearia_id: barbeariaId,
          barbeiro_id: barber.id,
          valor_total: productTotal,
          data: today
        }).select().single();

        if (txErr) throw txErr;
        
        // Correctly link the product sale to the transaction record
        const { error: saleErr } = await supabase.from('venda_produtos').insert({
           barbearia_id: barbeariaId,
           transacao_id: txData.id,
           produto_id: selectedProductId,
           barbeiro_id: barber.id,
           quantidade: productQty,
           valor_unitario: productPrice,
           valor_total: productTotal,
           comissao_total: productCommission
        });

        if (saleErr) throw saleErr;

        // Ensure payment record exists for correct cash flow
        await supabase.from('transacao_pagamentos').insert({
          transacao_id: txData.id,
          metodo: paymentMethod, // Assuming product is paid with the currently selected method
          valor: productTotal
        });

        // Update Stock
        await supabase.from('produtos')
          .update({ estoque: product.estoque - productQty })
          .eq('id', product.id)
          .eq('barbearia_id', barbeariaId);

        resetForm();
        onSuccess();
      } catch (err: any) {
         alert('Erro: ' + err.message);
      } finally {
         setLoading(false);
      }
    }
  }

  async function handleArchive() {
    if (loading || isDeleting) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('barbeiros')
        .update({ ativo: false })
        .eq('id', barber.id)
        .eq('barbearia_id', barbeariaId);
      
      if (error) throw error;
      onSuccess();
    } catch (err: any) {
      alert('Erro ao arquivar: ' + err.message);
    } finally {
      setIsDeleting(false);
      setShowConfirmDelete(false);
    }
  }

  function resetForm() {
    setServiceName('');
    setAmount('');
    setTip('');
    setIsSplit(false);
    setAmount1('');
    setAmount2('');
    setSelectedProductId('');
    setQuantity('1');
    setIsExpanded(false);
  }

  return (
    <div className={`glass overflow-hidden rounded-2xl border transition-all duration-300 group relative ${
      isExpanded ? 'border-accent neon-border shadow-2xl scale-[1.01]' : 'border-border hover:border-accent/50'
    }`}>
      {/* Overlay de Confirmação de Exclusão */}
      {showConfirmDelete && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-300">
          <div className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="h-12 w-12 rounded-full bg-danger/20 flex items-center justify-center">
                <Trash2 className="h-6 w-6 text-danger" />
              </div>
            </div>
            <div>
              <h4 className="font-bold text-white">Arquivar {barber.nome}?</h4>
              <p className="text-[10px] text-muted uppercase tracking-widest mt-1">Ele sairá da lista de atendimento.</p>
            </div>
            <div className="flex gap-2 justify-center">
              <button 
                onClick={() => setShowConfirmDelete(false)}
                className="px-4 py-2 text-xs font-bold text-muted hover:text-white transition-colors"
                disabled={isDeleting}
              >
                Cancelar
              </button>
              <button 
                onClick={handleArchive}
                className="px-4 py-2 bg-danger text-white text-xs font-bold rounded-lg hover:scale-105 active:scale-95 transition-all shadow-lg shadow-danger/20 flex items-center gap-2"
                disabled={isDeleting}
              >
                {isDeleting ? '...' : <><Trash2 className="h-3 w-3" /> Arquivar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex cursor-pointer items-center justify-between p-5"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-accent/10">
            {barber.foto_url ? (
              <img src={barber.foto_url} alt="" className="h-full w-full object-cover" />
            ) : (
              <User className="h-6 w-6 text-accent" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg text-white">{barber.nome}</h3>
              {barber.destaque_label && (
                <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-black text-accent">
                  {barber.destaque_label}
                </span>
              )}
              <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => { e.stopPropagation(); onEdit(barber); }}
                  className="p-1.5 hover:bg-white/10 rounded-lg text-muted hover:text-white transition-colors"
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowConfirmDelete(true); }}
                  className="p-1.5 hover:bg-danger/20 rounded-lg text-muted hover:text-danger transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <p className="text-xs text-muted uppercase tracking-widest font-medium">
              Comissão: {barber.comissao}{barber.comissao_tipo === 'percentual' ? '%' : ' R$'}
            </p>
            {(barber.titulo || barber.especialidade) && (
              <p className="mt-1 line-clamp-1 text-xs text-muted">
                {barber.titulo || barber.especialidade}
              </p>
            )}
          </div>
        </div>
        <button type="button" onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }} className={`p-2 rounded-lg transition-colors shrink-0 ${isExpanded ? 'bg-accent text-black' : 'bg-white/5 text-muted hover:text-white'}`}>
          <div className="flex items-center gap-1 sm:gap-2">
            <span className="text-xs sm:text-sm font-bold">{isExpanded ? 'Fechar' : '+ Lançar'}</span>
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </button>
      </div>

      {isExpanded && (
        <div className="border-t border-border/50 bg-black/20 p-4 sm:p-6 space-y-6 animate-in slide-in-from-top duration-300">
          
          {/* Alternância de Modo (Serviço vs Produto) */}
          <div className="flex gap-2 p-1 bg-black/40 rounded-xl border border-white/5">
             <button 
                onClick={() => setMode('service')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'service' ? 'bg-accent text-black shadow-lg shadow-accent/20' : 'text-muted hover:text-white'}`}
             >
                <Scissors className="h-3 w-3" />
                SERVIÇO
             </button>
             <button 
                onClick={() => setMode('product')}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${mode === 'product' ? 'bg-accent text-black shadow-lg shadow-accent/20' : 'text-muted hover:text-white'}`}
             >
                <Package className="h-3 w-3" />
                VENDA PRODUTO
             </button>
          </div>

          {mode === 'service' ? (
             <>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <label className="text-xs uppercase font-bold text-muted ml-1">Serviço</label>
                   <input 
                     type="text" 
                     placeholder="Ex: Corte Degradê"
                     value={serviceName}
                     onChange={(e) => setServiceName(e.target.value)}
                     className="w-full rounded-xl border border-border bg-card/50 p-3 text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                   />
                 </div>
                 <div className="space-y-2">
                   <label className="text-xs uppercase font-bold text-muted ml-1">Valor (R$)</label>
                   <input 
                     type="number" 
                     placeholder="0,00"
                     value={amount}
                     onChange={(e) => setAmount(e.target.value)}
                     className="w-full rounded-xl border border-border bg-card/50 p-3 text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                   />
                 </div>
               </div>

               <div className="space-y-4">
                 <div className="flex items-center justify-between px-1">
                   <label className="text-xs uppercase font-bold text-muted">Pagamento</label>
                   <button 
                     onClick={() => setIsSplit(!isSplit)}
                     className={`text-[10px] font-bold px-2 py-1 rounded-md transition-all ${isSplit ? 'bg-accent text-black' : 'bg-white/5 text-muted hover:text-white'}`}
                   >
                     {isSplit ? '✓ Combinado' : '+ Combinar 2 formas'}
                   </button>
                 </div>

                 {!isSplit ? (
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="flex gap-2">
                       {[
                         { id: 'dinheiro', icon: Banknote },
                         { id: 'pix', icon: Sparkles },
                         { id: 'cartao', icon: CreditCard }
                       ].map((meth) => (
                         <button
                           key={meth.id}
                           onClick={() => setPaymentMethod(meth.id as any)}
                           className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-xl border transition-all ${
                             paymentMethod === meth.id ? 'border-accent bg-accent/10 text-accent shadow-lg shadow-accent/5' : 'border-border bg-card/30 text-muted hover:text-white'
                           }`}
                         >
                           <meth.icon className="h-5 w-5" />
                           <span className="text-[10px] uppercase font-bold">{meth.id}</span>
                         </button>
                       ))}
                     </div>
                     <div className="space-y-2">
                       <input 
                         type="number" 
                         placeholder="Caixinha (Opcional)"
                         value={tip}
                         onChange={(e) => setTip(e.target.value)}
                         className="w-full rounded-xl border border-border bg-card/50 p-3 text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                       />
                     </div>
                   </div>
                 ) : (
                   <div className="space-y-4 bg-black/20 p-4 rounded-2xl border border-white/5 animate-in fade-in duration-300">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         {/* Payment 1 */}
                         <div className="space-y-2">
                            <div className="flex gap-1">
                              {['dinheiro', 'pix', 'cartao'].map((m) => (
                                <button
                                  key={m}
                                  onClick={() => setPaymentMethod(m as any)}
                                  className={`flex-1 p-1.5 rounded-lg border text-[9px] uppercase font-bold transition-all ${paymentMethod === m ? 'bg-accent/20 border-accent text-accent' : 'border-border bg-white/5 text-muted'}`}
                                >
                                  {m}
                                </button>
                              ))}
                            </div>
                            <input 
                              type="number" 
                              placeholder="Valor 1"
                              value={amount1}
                              onChange={(e) => {
                                setAmount1(e.target.value);
                                const v = parseFloat(e.target.value || '0');
                                if (v <= serviceValue) setAmount2((serviceValue - v).toFixed(2));
                              }}
                              className="w-full rounded-xl border border-border bg-card/50 p-2 text-sm text-white focus:border-accent focus:outline-none"
                            />
                         </div>
                         {/* Payment 2 */}
                         <div className="space-y-2">
                            <div className="flex gap-1">
                              {['dinheiro', 'pix', 'cartao'].map((m) => (
                                <button
                                  key={m}
                                  onClick={() => setPaymentMethod2(m as any)}
                                  className={`flex-1 p-1.5 rounded-lg border text-[9px] uppercase font-bold transition-all ${paymentMethod2 === m ? 'bg-accent/20 border-accent text-accent' : 'border-border bg-white/5 text-muted'}`}
                                >
                                  {m}
                                </button>
                              ))}
                            </div>
                            <input 
                              type="number" 
                              placeholder="Valor 2"
                              value={amount2}
                              onChange={(e) => {
                                setAmount2(e.target.value);
                                const v = parseFloat(e.target.value || '0');
                                if (v <= serviceValue) setAmount1((serviceValue - v).toFixed(2));
                              }}
                              className="w-full rounded-xl border border-border bg-card/50 p-2 text-sm text-white focus:border-accent focus:outline-none"
                            />
                         </div>
                      </div>
                      <div className="flex justify-between items-center px-1">
                        <span className="text-[10px] text-muted uppercase font-bold">Total Conferido:</span>
                        <span className={`text-xs font-bold ${(parseFloat(amount1||'0') + parseFloat(amount2||'0')) === serviceValue ? 'text-accent' : 'text-danger'}`}>
                           R$ {(parseFloat(amount1||'0') + parseFloat(amount2||'0')).toFixed(2)} / R$ {serviceValue.toFixed(2)}
                        </span>
                      </div>
                   </div>
                 )}
               </div>

               {/* Real-time split visualization - Service */}
               <div className="rounded-2xl bg-black/40 p-4 sm:p-5 border border-white/5">
                 <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-4">
                   <div className="space-y-1">
                     <p className="text-[10px] uppercase font-bold text-muted">Produzido</p>
                     <p className="text-xl font-bold text-white">R$ {serviceValue.toFixed(2)}</p>
                   </div>
                   <div className="space-y-1">
                     <p className="text-[10px] uppercase font-bold text-accent">Comissão</p>
                     <p className="text-xl font-bold text-accent">R$ {commissionValue.toFixed(2)}</p>
                   </div>
                   <div className="space-y-1">
                     <p className="text-[10px] uppercase font-bold text-accent-gold">Caixinha</p>
                     <p className="text-xl font-bold text-accent-gold">R$ {tipValue.toFixed(2)}</p>
                   </div>
                   <div className="space-y-1">
                     <p className="text-[10px] uppercase font-bold text-white/40">Casa</p>
                     <p className="text-xl font-bold text-white/40">R$ {barbeariaProfit.toFixed(2)}</p>
                   </div>
                 </div>
               </div>
             </>
          ) : (
             <>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <label className="text-xs uppercase font-bold text-muted ml-1">Selecionar Produto</label>
                   <select 
                     value={selectedProductId}
                     onChange={(e) => setSelectedProductId(e.target.value)}
                     className="w-full rounded-xl border border-border bg-card/50 p-3 text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                   >
                      <option value="">Selecione...</option>
                      {availableProducts.map(p => (
                         <option key={p.id} value={p.id}>{p.nome} - R$ {p.valor_venda}</option>
                      ))}
                   </select>
                 </div>
                 <div className="space-y-2">
                   <label className="text-xs uppercase font-bold text-muted ml-1">Quantidade</label>
                   <input 
                     type="number" 
                     value={quantity}
                     onChange={(e) => setQuantity(e.target.value)}
                     className="w-full rounded-xl border border-border bg-card/50 p-3 text-white focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                   />
                 </div>
               </div>

               {/* Real-time split visualization - Product */}
               <div className="rounded-2xl bg-black/40 p-5 border border-white/5">
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                   <div className="space-y-1">
                     <p className="text-[10px] uppercase font-bold text-muted">Venda Total</p>
                     <p className="text-xl font-bold text-white">R$ {productTotal.toFixed(2)}</p>
                   </div>
                   <div className="space-y-1">
                     <p className="text-[10px] uppercase font-bold text-accent">Comissão</p>
                     <p className="text-xl font-bold text-accent">R$ {productCommission.toFixed(2)}</p>
                   </div>
                   <div className="space-y-1">
                     <p className="text-[10px] uppercase font-bold text-white/40">Lucro Casa</p>
                     <p className="text-xl font-bold text-white/40">R$ {(productTotal - productCommission).toFixed(2)}</p>
                   </div>
                 </div>
               </div>
             </>
          )}

          <button
            onClick={handleAddService}
            disabled={loading || (mode === 'service' ? serviceValue <= 0 : !selectedProductId)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-accent p-4 font-bold text-black transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
          >
            {loading ? (
              <div className="h-5 w-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <Check className="h-5 w-5" />
                Confirmar Lançamento
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
