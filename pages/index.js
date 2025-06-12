import { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// --- Componentes de UI reutilizáveis ---

const FloatingHeader = () => (
    <div className="fixed top-0 left-0 w-full bg-slate-900 z-50 shadow-lg p-2">
        <div className="container mx-auto flex justify-center items-center">
            <img 
                src="https://pumanordeste.org/assets/img/cta/logo-cta2.png" 
                alt="Logomarca da Empresa Puma Nordeste" 
                className="h-16 w-auto"
            />
        </div>
    </div>
);

const LoadingIndicator = ({ message }) => (
    <div className="text-center my-8">
        <svg className="animate-spin h-10 w-10 text-sky-500 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-slate-400 mt-3 text-lg">{message}</p>
    </div>
);

const ErrorDisplay = ({ message, title, onDismiss }) => (
    <div className="bg-red-700/80 border border-red-500 text-red-100 px-4 py-3 rounded-md relative mb-6" role="alert">
        <strong className="font-bold">{title}</strong>
        <span className="block sm:inline ml-1">{message}</span>
        <button type="button" className="absolute top-0 bottom-0 right-0 px-4 py-3" onClick={onDismiss}>
             <svg className="fill-current h-6 w-6 text-red-200 hover:text-red-50" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Fechar</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>
        </button>
    </div>
);

// --- Componente Principal da Página ---
export default function CotaçãoPage() {
    const [step, setStep] = useState(1); // 1: Registo, 2: Placa, 3: Resultado
    const [userData, setUserData] = useState({ name: '', cpf: '', email: '', phone: '' });
    const [plate, setPlate] = useState('');
    const [vehicleData, setVehicleData] = useState(null);
    const [quotation, setQuotation] = useState(null);
    const [loading, setLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [error, setError] = useState(null);

    // Função auxiliar para formatar valores monetários
    const formatToBRL = (value) => {
        if (typeof value !== 'number') return 'R$ 0,00';
        return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    const handleUserDataSubmit = (e) => {
        e.preventDefault();
        // Adicionar validação se necessário
        setStep(2);
    };

    const handleConsult = async () => {
        if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plate)) {
            setError({ title: "Erro na Placa!", message: "Formato de placa inválido." });
            return;
        }
        setLoading(true);
        setLoadingMessage('A consultar dados do veículo...');
        setError(null);
        setVehicleData(null);
        setQuotation(null);

        try {
            // Nota: O backend ainda precisa de ser adicionado, estas chamadas vão falhar por agora.
            const plateRes = await fetch(`/api/consultar-placa/${plate}`);
            if (!plateRes.ok) {
                const errorData = await plateRes.json();
                throw new Error(errorData.detail || 'Falha ao consultar a placa.');
            }
            const plateData = await plateRes.json();
            setVehicleData(plateData.informacoes_veiculo);

            setLoadingMessage('A calcular cotação...');
            // Simplificado por agora, o backend faria este cálculo
            const fipeValue = parseFloat(String(plateData.fipe[0].valor).replace(/[^\d.]/g, ''));
            const mockQuotation = {
                valor_fipe: fipeValue,
                planos: [
                    { nome: "Plano Ouro", descricao: "Cobertura completa", valor_mensalidade: 250.50, valor_adesao: 100 },
                    { nome: "Plano Prata", descricao: "Cobertura essencial", valor_mensalidade: 180.75, valor_adesao: 100 }
                ]
            };
            setQuotation(mockQuotation);
            setStep(3);
        } catch (err) {
            setError({ title: "Erro na Consulta!", message: err.message });
        } finally {
            setLoading(false);
        }
    };
    
    const handleGeneratePdf = (plano, valorFipe) => {
        alert("A gerar PDF...");
        const doc = new jsPDF();
        doc.text(`Proposta de Proteção Veicular`, 14, 20);
        doc.text(`Cliente: ${userData.name}`, 14, 30);
        doc.text(`Veículo: ${vehicleData.marca} ${vehicleData.modelo} - ${vehicleData.placa}`, 14, 37);
        doc.text(`Valor FIPE: ${formatToBRL(valorFipe)}`, 14, 44);
        
        doc.autoTable({
            startY: 55,
            head: [['Plano', 'Descrição', 'Mensalidade', 'Adesão']],
            body: [
                [
                    plano.nome,
                    plano.descricao,
                    formatToBRL(plano.valor_mensalidade),
                    formatToBRL(plano.valor_adesao)
                ]
            ],
        });
        
        doc.save(`Proposta_${userData.name.split(' ')[0]}_${vehicleData.placa}.pdf`);
    };

    return (
        <div className="bg-gradient-to-br from-slate-900 to-slate-700 text-gray-200 min-h-screen pt-24 pb-12">
            <FloatingHeader />
            <main className="container mx-auto p-4 md:p-8 max-w-3xl bg-slate-800 shadow-2xl rounded-xl">
                <header className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-sky-400">Cotação de Proteção Veicular</h1>
                    <p className="text-slate-400 mt-2">
                        {step === 1 && "Preencha os seus dados para iniciar a cotação."}
                        {step === 2 && "Agora, informe a placa do veículo."}
                        {step === 3 && "Confira os resultados da sua cotação."}
                    </p>
                </header>

                {error && <ErrorDisplay title={error.title} message={error.message} onDismiss={() => setError(null)} />}

                {step === 1 && (
                    <section className="bg-slate-700/50 p-6 rounded-lg shadow-xl mb-8 ring-1 ring-slate-600">
                        <form onSubmit={handleUserDataSubmit}>
                            <div className="mb-4">
                                <label htmlFor="userName" className="block text-sm font-medium text-sky-300 mb-1">Nome Completo:</label>
                                <input type="text" id="userName" required value={userData.name} onChange={e => setUserData({...userData, name: e.target.value})} className="w-full p-3 border border-slate-600 bg-slate-800 text-gray-200 rounded-md shadow-sm focus:ring-2 focus:ring-sky-500"/>
                            </div>
                            <div className="mb-4">
                                <label htmlFor="userCpf" className="block text-sm font-medium text-sky-300 mb-1">CPF:</label>
                                <input type="text" id="userCpf" required value={userData.cpf} onChange={e => setUserData({...userData, cpf: e.target.value})} className="w-full p-3 border border-slate-600 bg-slate-800 text-gray-200 rounded-md shadow-sm focus:ring-2 focus:ring-sky-500"/>
                            </div>
                            <div className="mb-4">
                                <label htmlFor="userEmail" className="block text-sm font-medium text-sky-300 mb-1">Email:</label>
                                <input type="email" id="userEmail" required value={userData.email} onChange={e => setUserData({...userData, email: e.target.value})} className="w-full p-3 border border-slate-600 bg-slate-800 text-gray-200 rounded-md shadow-sm focus:ring-2 focus:ring-sky-500"/>
                            </div>
                            <div className="mb-6">
                                <label htmlFor="userPhone" className="block text-sm font-medium text-sky-300 mb-1">Telefone:</label>
                                <input type="tel" id="userPhone" required value={userData.phone} onChange={e => setUserData({...userData, phone: e.target.value})} className="w-full p-3 border border-slate-600 bg-slate-800 text-gray-200 rounded-md shadow-sm focus:ring-2 focus:ring-sky-500"/>
                            </div>
                            <button type="submit" className="w-full bg-sky-500 hover:bg-sky-600 text-white font-semibold py-3 px-6 rounded-md shadow-md transition">Continuar</button>
                        </form>
                    </section>
                )}

                {step === 2 && (
                     <section className="bg-slate-700/50 p-6 rounded-lg shadow-xl mb-8 ring-1 ring-slate-600">
                        <label htmlFor="plateInput" className="block text-sm font-medium text-sky-300 mb-2">Placa do Veículo:</label>
                        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3">
                            <input 
                                type="text" 
                                id="plateInput" 
                                value={plate}
                                onChange={(e) => setPlate(e.target.value.toUpperCase())}
                                placeholder="AAA0A00 OU AAA0000" 
                                className="flex-grow p-3 border border-slate-600 bg-slate-800 text-gray-200 rounded-md shadow-sm focus:ring-2 focus:ring-sky-500 uppercase"
                            />
                            <button onClick={handleConsult} className="bg-sky-500 hover:bg-sky-600 text-white font-semibold py-3 px-6 rounded-md shadow-md transition">Consultar</button>
                        </div>
                    </section>
                )}
                
                {loading && <LoadingIndicator message={loadingMessage} />}

                {step === 3 && vehicleData && (
                     <section className="bg-slate-700/50 p-6 rounded-lg shadow-xl mb-8 ring-1 ring-slate-600">
                        <h2 className="text-2xl font-semibold text-sky-400 mb-4 border-b border-slate-600 pb-2">Dados do Veículo</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-3 text-slate-300">
                            <p><strong className="text-sky-300">Placa:</strong> {vehicleData.placa || 'N/A'}</p>
                            <p><strong className="text-sky-300">Modelo:</strong> {vehicleData.modelo || 'N/A'}</p>
                            <p><strong className="text-sky-300">Marca:</strong> {vehicleData.marca || 'N/A'}</p>
                            <p><strong className="text-sky-300">Cor:</strong> {vehicleData.cor || 'N/A'}</p>
                            <p><strong className="text-sky-300">Ano/Modelo:</strong> {vehicleData.ano}/{vehicleData.ano_modelo}</p>
                            <p><strong className="text-sky-300">Combustível:</strong> {vehicleData.combustivel || 'N/A'}</p>
                        </div>
                    </section>
                )}

                {step === 3 && quotation && (
                     <section className="bg-slate-700/50 p-6 rounded-lg shadow-xl ring-1 ring-slate-600">
                        <h2 className="text-2xl font-semibold text-sky-400 mb-1 border-b border-slate-600 pb-2">Planos Disponíveis</h2>
                        <div className="my-4 p-4 bg-slate-600/30 rounded-md">
                            <p className="text-md text-slate-400">
                                Valor do Veículo (FIPE): <strong className="text-emerald-400 text-lg">{formatToBRL(quotation.valor_fipe)}</strong>
                            </p>
                        </div>
                        <div className="space-y-6 mt-6">
                            {quotation.planos.map((plano, index) => (
                                <div key={index} className="border border-slate-600 p-6 rounded-lg shadow-lg hover:shadow-sky-500/30 transition-shadow">
                                    <h3 className="text-2xl font-semibold text-white mb-2">{plano.nome}</h3>
                                    <p className="text-slate-300 mb-4">{plano.descricao}</p>
                                    <div className="grid grid-cols-2 gap-4 text-center my-4 border-y border-slate-600 py-4">
                                        <div>
                                            <p className="text-sm text-slate-400">Mensalidade</p>
                                            <p className="text-xl font-bold text-white">{formatToBRL(plano.valor_mensalidade)}</p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-slate-400">Adesão</p>
                                            <p className="text-xl font-bold text-white">{formatToBRL(plano.valor_adesao)}</p>
                                        </div>
                                    </div>
                                    <button 
                                        onClick={() => handleGeneratePdf(plano, quotation.valor_fipe)}
                                        className="mt-6 w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-md transition">
                                        Gerar Proposta
                                    </button>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

            </main>
        </div>
    );
}
