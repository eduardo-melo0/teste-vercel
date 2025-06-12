import os
import httpx
import supabase
from fastapi import FastAPI, HTTPException, Body
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

# --- Modelos de Dados ---
class VehicleInfo(BaseModel):
    placa: str
    modelo: str
    marca: str
    cor: str
    ano: str
    ano_modelo: str
    combustivel: str
    segmento: str

class CepDetails(BaseModel):
    is_metropolitan: bool

class QuotationRequest(BaseModel):
    valor_fipe: str
    vehicle_info: VehicleInfo
    cep_details: CepDetails

class Plan(BaseModel):
    nome: str
    descricao: str
    valor_mensalidade: float
    valor_adesao: float

class QuotationResponse(BaseModel):
    valor_fipe: float
    planos: List[Plan]

# --- Configuração da Aplicação ---
app = FastAPI()

# --- Configuração das APIs Externas ---
PLACA_FIPE_API_KEY = os.environ.get("PLACA_FIPE_API_KEY")
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
supabase_client = None
if SUPABASE_URL and SUPABASE_KEY:
    supabase_client = supabase.create_client(SUPABASE_URL, SUPABASE_KEY)

# --- Funções Auxiliares ---
def get_vehicle_type(vehicle_info: VehicleInfo) -> str:
    segmento = (vehicle_info.segmento or '').lower()
    combustivel = (vehicle_info.combustivel or '').lower()
    if 'caminhao' in segmento or 'cao.trator' in segmento: return 'caminhao'
    if 'moto' in segmento: return 'moto'
    if 'diesel' in combustivel or 'camionete' in segmento or 'van' in segmento: return 'diesel_van'
    return 'carro_passeio'

def get_price_table_name(vehicle_type: str, is_metropolitan: bool) -> Optional[str]:
    region_suffix = '' if is_metropolitan else '_interior'
    table_map = {
        'moto': f'precos_faixa_moto{region_suffix}',
        'carro_passeio': 'precos_faixa_carro_passeio',
        'diesel_van': 'precos_faixa_diesel_van',
        'caminhao': 'precos_faixa_caminhao',
    }
    return table_map.get(vehicle_type)

# --- Endpoints da API ---
# CORREÇÃO: Removido o prefixo /api dos endpoints. A Vercel já trata disso.
@app.get("/")
def read_root():
    return {"status": "API Python Online"}

@app.get("/consultar-placa/{plate}")
async def consult_plate(plate: str):
    if not PLACA_FIPE_API_KEY:
        raise HTTPException(status_code=500, detail="Chave da API de placas não configurada.")
    url = f"https://api.placafipe.com.br/getplacafipe/{plate}/{PLACA_FIPE_API_KEY}"
    async with httpx.AsyncClient() as client:
        try:
            res = await client.get(url, timeout=15.0)
            res.raise_for_status()
            data = res.json()
            if data.get("codigo") != 1 or not data.get("fipe"):
                raise HTTPException(status_code=404, detail=data.get("msg", "Dados FIPE não encontrados."))
            return data
        except httpx.RequestError as e:
            raise HTTPException(status_code=503, detail=f"Erro de comunicação com API de placas: {e}")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

@app.post("/calcular-cotacao")
def calculate_quotation(request: QuotationRequest):
    if not supabase_client:
        raise HTTPException(status_code=503, detail="Base de dados indisponível.")

    try:
        valor_fipe_str = request.valor_fipe.replace('R$', '').replace('.', '').replace(',', '.').strip()
        car_value = float(valor_fipe_str)
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail="Valor FIPE inválido.")

    vehicle_type = get_vehicle_type(request.vehicle_info)
    price_table = get_price_table_name(vehicle_type, request.cep_details.is_metropolitan)

    if not price_table:
        raise HTTPException(status_code=404, detail=f"Tipo de veículo ou região não suportado.")

    price_tiers_res = supabase_client.from_(price_table).select("*").lte("faixa_fipe_inicio", car_value).gte("faixa_fipe_fim", car_value).execute()

    if not price_tiers_res.data:
        raise HTTPException(status_code=404, detail=f"Não há planos para este valor de veículo.")

    final_plans = [Plan(
        nome=tier['nome_plano'],
        descricao="Descrição do plano aqui", # Adicionar descrição se existir no Supabase
        valor_mensalidade=tier['valor_mensalidade'],
        valor_adesao=tier['valor_adesao']
    ) for tier in price_tiers_res.data]

    return QuotationResponse(valor_fipe=car_value, planos=final_plans)
