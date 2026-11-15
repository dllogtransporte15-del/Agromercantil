/**
 * Tipagens completas para a Integração com a Gerenciadora de Risco SIGA GR (REST+JSON v1)
 * Documentação OpenAPI 3.0 / Swagger: /api-docs/v1/swagger.yaml
 */

export type SigaProduct = 'siga' | 'siga_plus';

export type SigaVehicleType =
  | 'Baú'
  | 'BI-Caçamba'
  | 'BI-Trem'
  | 'Container'
  | 'LS'
  | 'Rodotrem'
  | 'Sider'
  | 'Tanque'
  | 'Truck'
  | 'Vanderléia';

export type SigaDriverHistory =
  | 'Primeira viagem'
  | 'Com histórico'
  | 'Agregado'
  | 'Frota'
  | 'Terceiro';

export type SigaAnalysisState =
  | 'draft'
  | 'awaiting_analysis'
  | 'under_analysis'
  | 'pending'
  | 'awaiting_reanalysis'
  | 'approved'
  | 'authorized_by_manager'
  | 'denied';

export type SigaDenialReason =
  | 'references_issue'
  | 'expired_docs'
  | 'vehicle_issue'
  | 'driver_license'
  | 'inactivity'
  | 'other';

export type SigaProfessionalReferenceStatus = 'pending' | 'verified' | 'rejected';

export type SigaSimulationTag =
  | 'simulate_approval'
  | 'simulate_denial'
  | 'simulate_authorization'
  | 'simulate_comment'
  | 'simulate_issue'
  | 'biometrics_requested';

export interface SigaConfig {
  environment: 'staging' | 'production';
  apiUrl: string; // https://api.staging.sigagr.com.br ou https://api.sigagr.com.br
  email: string;
  password?: string;
  requesterEmail: string;
  businessUnit?: string;
  customerBranch?: string;
  enabled: boolean;
  autoApproveInRisk?: boolean;
  authToken?: string;
  authTokenExpiresAt?: string;
}

export interface SigaUploadResponse {
  blob: {
    filename: string;
    content_type: string;
    byte_size: number;
    checksum: string;
    token: string;
    created_at: string;
  };
}

export interface SigaReferenceInput {
  name: string;
  phone: string;
}

export interface SigaProfessionalReferenceItem {
  id: number;
  name: string;
  phone: string;
  status: SigaProfessionalReferenceStatus;
  created_at: string;
  updated_at: string;
}

export interface SigaPersonalReferenceItem {
  id: number;
  name: string;
  phone: string;
  created_at: string;
  updated_at: string;
}

export interface SigaIssueItem {
  id: number;
  reason: string;
  body?: string | null;
  solved: boolean;
  created_at: string;
  updated_at?: string;
}

export interface SigaCommentItem {
  id: number;
  author?: {
    fullname: string;
  } | null;
  body: string;
  support_team?: boolean;
  created_at: string;
}

export interface SigaDocumentInfo {
  content_type: string;
  filename: string;
  url: string;
}

export interface SigaTrailerInput {
  license_plate: string;
  license_file?: string | null; // token do upload
  license_number?: string | null; // renavam
  owner_name?: string | null;
  owner_document?: string | null;
  owner_phone?: string | null;
  owner_details?: string | null;
  antt_owner_document?: string | null;
}

export interface SigaCreateAnalysisInput {
  product_name: SigaProduct;
  requester_email: string;
  driver_personal_document: string; // CPF
  vehicle_type: SigaVehicleType;
  truck_license_plate: string;
  trailer_1_license_plate?: string | null;
  trailer_2_license_plate?: string | null;
  trailer_3_license_plate?: string | null;
  business_unit?: string | null;
  tags?: string[];
}

export interface SigaUpdateAnalysisInput {
  business_unit?: string | null;
  goods_type?: string | null;
  load_cost?: number | null;
  hirer?: string | null;
  origin?: string | null;
  destination?: string | null;
  driver?: {
    fullname?: string | null;
    national_id_number?: string | null;
    national_id_issuer?: string | null;
    birthdate?: string | null; // YYYY-MM-DD
    mother?: string | null;
    license_file?: string | null; // Token upload CNH
    license_number?: string | null; // CNH
    license_security_code?: string | null;
    license_issued_location?: string | null;
    street?: string | null;
    street_number?: string | null;
    building?: string | null;
    district?: string | null;
    city?: string | null;
    state?: string | null;
    zipcode?: string | null;
    phone?: string | null;
  };
  truck?: {
    license_number?: string | null; // Renavam
    license_file?: string | null; // Token upload CRLV
    photo?: string | null; // Token upload Foto do Cavalo/Truck
    tractor_trailer_photo?: string | null; // Token upload Foto do Conjunto
    owner_name?: string | null;
    owner_document?: string | null;
    owner_phone?: string | null;
    owner_details?: string | null;
    another_antt_owner?: boolean;
    antt_owner_document?: string | null;
    trailers?: SigaTrailerInput[];
  };
  driver_history?: SigaDriverHistory | null;
  trips_count?: number | null;
  last_trip_at?: string | null; // YYYY-MM-DD
  last_license_plate?: string | null;
  professional_references?: SigaReferenceInput[];
  personal_references?: SigaReferenceInput[];
  tags?: string[];
}

export interface SigaAnalysisResponseData {
  process_number: string;
  state: SigaAnalysisState;
  product_name: SigaProduct;
  mode?: string;
  requested_at?: string | null;
  last_event_at?: string | null;
  expires_at?: string | null;
  denial_reason?: SigaDenialReason | null;
  requester?: {
    fullname: string;
    email: string;
  };
  customer_branch?: {
    name: string;
  };
  business_unit?: string | null;
  assignee?: {
    fullname: string;
  } | null;
  goods_type?: string | null;
  load_cost?: number | null;
  hirer?: string | null;
  origin?: string | null;
  destination?: string | null;
  driver_history?: SigaDriverHistory | null;
  trips_count?: number | null;
  last_trip_at?: string | null;
  last_license_plate?: string | null;
  driver?: {
    fullname?: string | null;
    personal_document: string;
    national_id_number?: string | null;
    national_id_issuer?: string | null;
    birthdate?: string | null;
    mother?: string | null;
    license_file?: SigaDocumentInfo | null;
    license_number?: string | null;
    license_issued_location?: string | null;
    license_security_code?: string | null;
    street?: string | null;
    street_number?: string | null;
    building?: string | null;
    district?: string | null;
    city?: string | null;
    state?: string | null;
    zipcode?: string | null;
    phone?: string | null;
  };
  truck?: {
    license_plate: string;
    vehicle_type: SigaVehicleType;
    license_file?: SigaDocumentInfo | null;
    license_number?: string | null;
    owner_name?: string | null;
    owner_document?: string | null;
    owner_phone?: string | null;
    owner_details?: string | null;
    antt_owner_document?: string | null;
    photo?: SigaDocumentInfo | null;
    tractor_trailer_photo?: SigaDocumentInfo | null;
    trailers?: Array<{
      license_plate: string;
      license_file?: SigaDocumentInfo | null;
      license_number?: string | null;
      owner_name?: string | null;
      owner_document?: string | null;
      owner_phone?: string | null;
      owner_details?: string | null;
      antt_owner_document?: string | null;
    }>;
  };
  professional_references?: SigaProfessionalReferenceItem[];
  personal_references?: SigaPersonalReferenceItem[];
  comments?: SigaCommentItem[];
  issues?: SigaIssueItem[];
  via?: string;
  created_at?: string;
  tags?: string[];
}

export interface SigaRequestRecord {
  id: string; // Identificador único DLLOG Transportes
  processNumber: string; // Número do processo SIGA GR
  state: SigaAnalysisState;
  productName: SigaProduct;
  shipmentId?: string;
  driverId?: string;
  driverName: string;
  driverCpf: string;
  driverMother?: string;
  driverBirthdate?: string;
  truckPlate: string;
  vehicleType: SigaVehicleType;
  origin?: string;
  destination?: string;
  loadCost?: number;
  denialReason?: SigaDenialReason | null;
  issuesCount?: number;
  unsolvedIssuesCount?: number;
  commentsCount?: number;
  expiresAt?: string | null;
  createdAt: string;
  updatedAt: string;
  concludedAt?: string | null;
  createdById?: string;
  createdByName?: string;
  rawAnalysis?: SigaAnalysisResponseData;
}
