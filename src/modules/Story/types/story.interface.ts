export interface IStory {
  id: string;
  userId: string;
  content: string;
  isApproved: boolean;
  approvedAt: Date | null;
  approvedBy: string | null;
  rejectedAt: Date | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
  isVisible: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStoryResponse {
  id: string;
  content: string;
  isApproved: boolean;
  isVisible: boolean;
  createdAt: Date;
  updatedAt: Date;
  user: {
    username: string;
    displayName?: string;
    firstName?: string;
    lastName?: string;
    isAnonymous: boolean;
  };
}

export interface IAdminStoryResponse extends IStoryResponse {
  userId: string;
  approvedAt: Date | null;
  approvedBy: string | null;
  rejectedAt: Date | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
}

export interface ICreateStoryRequest {
  content: string;
}

export interface IUpdateStoryRequest {
  content: string;
}

export interface IRejectStoryRequest {
  reason: string;
}