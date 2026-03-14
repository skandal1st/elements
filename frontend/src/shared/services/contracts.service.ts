import { apiGet, apiPost, apiPatch, apiDelete } from '../api/client'

export interface Counterparty {
  id: string
  legacy_num?: number | null
  name: string
  full_name?: string | null
  inn?: string | null
  kpp?: string | null
  address?: string | null
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
}

export interface ContractType {
  id: string
  legacy_num?: number | null
  name: string
  is_active: boolean
  created_at?: string | null
  updated_at?: string | null
}

export interface ContractAct {
  id: string
  contract_id: string
  legacy_num?: number | null
  doctype: number
  number?: string | null
  act_date?: string | null
  notice?: string | null
  amount: string
  created_at?: string | null
  updated_at?: string | null
}

export interface ContractListItem {
  id: string
  document_id?: string | null
  legacy_num?: number | null
  contract_type_id?: string | null
  counterparty_id?: string | null
  number: string
  date_begin?: string | null
  date_end?: string | null
  name: string
  sum_amount: string
  term?: string | null
  done: boolean
  created_at?: string | null
  updated_at?: string | null
  sum_acts: string
  sum_pp: string
  rest_acts: string
  rest_pp: string
  counterparty_name?: string | null
  contract_type_name?: string | null
  funding_name?: string | null
  subunit_name?: string | null
}

export interface ContractDetail extends ContractListItem {
  full_name?: string | null
  inv_num?: string | null
  comment?: string | null
  notice?: string | null
  funding_id?: string | null
  cost_code_id?: string | null
  subunit_id?: string | null
  created_by_id?: string | null
  acts: ContractAct[]
  files: { id: string; kind: string; file_path: string; file_name: string; created_at?: string | null }[]
}

export interface Funding {
  id: string
  legacy_num?: number | null
  name: string
  is_active: boolean
  created_at?: string | null
}

export interface CostCode {
  id: string
  legacy_num?: number | null
  name: string
  is_active: boolean
  created_at?: string | null
}

export interface Subunit {
  id: string
  legacy_id?: number | null
  name: string
  is_active: boolean
  created_at?: string | null
}

const BASE = '/contracts'

export const contractsService = {
  listContracts(params?: {
    number?: string
    date_begin_from?: string
    date_begin_to?: string
    counterparty_id?: string
    contract_type_id?: string
    funding_id?: string
    subunit_id?: string
    order_by?: string
  }): Promise<ContractListItem[]> {
    const search = new URLSearchParams()
    if (params) {
      Object.entries(params).forEach(([k, v]) => { if (v != null && v !== '') search.set(k, v) })
    }
    const q = search.toString()
    return apiGet<ContractListItem[]>(q ? `${BASE}/?${q}` : `${BASE}/`)
  },

  getContract(id: string): Promise<ContractDetail> {
    return apiGet<ContractDetail>(`${BASE}/${id}`)
  },

  createContract(data: Partial<ContractDetail> & { number: string; name: string }): Promise<ContractDetail> {
    return apiPost<ContractDetail>(`${BASE}/`, data)
  },

  updateContract(id: string, data: Partial<ContractDetail>): Promise<ContractDetail> {
    return apiPatch<ContractDetail>(`${BASE}/${id}`, data)
  },

  deleteContract(id: string): Promise<void> {
    return apiDelete(`${BASE}/${id}`)
  },

  listActs(contractId: string): Promise<ContractAct[]> {
    return apiGet<ContractAct[]>(`${BASE}/${contractId}/acts/`)
  },

  createAct(contractId: string, data: Partial<ContractAct>): Promise<ContractAct> {
    return apiPost<ContractAct>(`${BASE}/${contractId}/acts/`, data)
  },

  updateAct(contractId: string, actId: string, data: Partial<ContractAct>): Promise<ContractAct> {
    return apiPatch<ContractAct>(`${BASE}/${contractId}/acts/${actId}`, data)
  },

  deleteAct(contractId: string, actId: string): Promise<void> {
    return apiDelete(`${BASE}/${contractId}/acts/${actId}`)
  },

  listCounterparties(params?: { search?: string; is_active?: boolean }): Promise<Counterparty[]> {
    const search = new URLSearchParams()
    if (params?.search) search.set('search', params.search)
    if (params?.is_active != null) search.set('is_active', String(params.is_active))
    const q = search.toString()
    return apiGet<Counterparty[]>(q ? `${BASE}/counterparties/?${q}` : `${BASE}/counterparties/`)
  },

  createCounterparty(data: Partial<Counterparty> & { name: string }): Promise<Counterparty> {
    return apiPost<Counterparty>(`${BASE}/counterparties/`, data)
  },

  updateCounterparty(id: string, data: Partial<Counterparty>): Promise<Counterparty> {
    return apiPatch<Counterparty>(`${BASE}/counterparties/${id}`, data)
  },

  deleteCounterparty(id: string): Promise<void> {
    return apiDelete(`${BASE}/counterparties/${id}`)
  },

  /** Проверка контрагента по ИНН (ФНС, api-fns.ru). Требуется FNS_API_KEY на backend. */
  checkInn(inn: string): Promise<{ name: string; full_name: string; inn: string; kpp: string | null; address: string | null; status: string | null }> {
    const q = new URLSearchParams({ inn: inn.replace(/\D/g, '') })
    return apiGet(`${BASE}/check-inn?${q}`)
  },

  listContractTypes(params?: { is_active?: boolean }): Promise<ContractType[]> {
    const search = new URLSearchParams()
    if (params?.is_active != null) search.set('is_active', String(params.is_active))
    const q = search.toString()
    return apiGet<ContractType[]>(q ? `${BASE}/contract-types/?${q}` : `${BASE}/contract-types/`)
  },

  createContractType(data: { name: string; is_active?: boolean }): Promise<ContractType> {
    return apiPost<ContractType>(`${BASE}/contract-types/`, data)
  },

  updateContractType(id: string, data: Partial<ContractType>): Promise<ContractType> {
    return apiPatch<ContractType>(`${BASE}/contract-types/${id}`, data)
  },

  deleteContractType(id: string): Promise<void> {
    return apiDelete(`${BASE}/contract-types/${id}`)
  },

  listFunding(): Promise<Funding[]> {
    return apiGet<Funding[]>(`${BASE}/funding`)
  },

  listCostCodes(): Promise<CostCode[]> {
    return apiGet<CostCode[]>(`${BASE}/cost-codes`)
  },

  listSubunits(): Promise<Subunit[]> {
    return apiGet<Subunit[]>(`${BASE}/subunits`)
  },

  /** Создать договор из согласованного документа */
  createFromDocument(documentId: string, body?: { number?: string; contract_type_id?: string; counterparty_id?: string }): Promise<ContractDetail> {
    return apiPost<ContractDetail>(`${BASE}/from-document/${documentId}`, body ?? {})
  },

  /** Получить договор по документу (для проверки кнопки «Отправить в договора») */
  getContractByDocument(documentId: string): Promise<ContractDetail> {
    return apiGet<ContractDetail>(`${BASE}/from-document/${documentId}/contract`)
  },
}
