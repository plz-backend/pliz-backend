export type ReactionTarget = 'beg' | 'donation';

export interface IAddReactionRequest {
  emoji: string;
  targetType: ReactionTarget;
  targetId: string;
}

export interface IReactionCount {
  emoji: string;
  count: number;
  userReacted: boolean;
}

export interface IReactionsResponse {
  targetId: string;
  targetType: ReactionTarget;
  totalReactions: number;
  reactions: IReactionCount[];
  userReaction: string | null;  // current user's emoji or null
}

export interface IEmoji {
  emoji: string;
  name: string;
  category: string;
  subcategory: string;
}

export interface IEmojiCategory {
  category: string;
  emojis: IEmoji[];
}