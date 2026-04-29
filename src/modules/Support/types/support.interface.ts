export type TicketStatus = 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TicketCategory = 'account' | 'payment' | 'beg' | 'donation' | 'kyc' | 'technical' | 'other';
export type MessageSenderType = 'user' | 'agent' | 'ai';

export interface ICreateTicketRequest {
  subject: string;
  category: TicketCategory;
  message: string;
  contactEmail: string;       // ← user's preferred contact email
}

export interface IReplyTicketRequest {
  message: string;
}

export interface IAIChatRequest {
  message: string;
  sessionId?: string;
}

export interface IEscalateRequest {
  sessionId: string;
  subject: string;
  category: TicketCategory;
  contactEmail: string;       // ← required when escalating to human
}

export interface IChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface IAIChatResponse {
  sessionId: string;
  message: string;
  isAI: true;
  suggestHuman: boolean;
  suggestTicket: boolean;
}

export interface IMessageResponse {
  id: string;
  senderType: MessageSenderType;
  senderName: string;
  content: string;
  isRead: boolean;
  createdAt: Date;
}

export interface ITicketResponse {
  id: string;
  ticketNumber: string;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  contactEmail: string;
  assignedTo: string | null;
  messages: IMessageResponse[];
  createdAt: Date;
  updatedAt: Date;
}