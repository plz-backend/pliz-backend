export type AvatarType = 'photo' | 'initials' | 'library';

export const AVATAR_COLORS = [
  '#FF5733', '#33FF57', '#3357FF', '#FF33A1',
  '#33FFF5', '#FF8C33', '#8C33FF', '#FF3333',
  '#33FF8C', '#338CFF', '#FFD700', '#FF69B4',
  '#00CED1', '#FF6347', '#7B68EE', '#20B2AA',
] as const;

export const LIBRARY_AVATARS = [
  { id: 'avatar_1',  url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix' },
  { id: 'avatar_2',  url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka' },
  { id: 'avatar_3',  url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Kiki' },
  { id: 'avatar_4',  url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jasper' },
  { id: 'avatar_5',  url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Zara' },
  { id: 'avatar_6',  url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Milo' },
  { id: 'avatar_7',  url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Luna' },
  { id: 'avatar_8',  url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Cleo' },
  { id: 'avatar_9',  url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Nala' },
  { id: 'avatar_10', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Simba' },
  { id: 'avatar_11', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Kofi' },
  { id: 'avatar_12', url: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Amara' },
] as const;

export interface IProfilePictureResponse {
  userId: string;
  avatarType: AvatarType;
  avatarUrl: string | null;
  avatarColor: string | null;
  avatarLibraryId: string | null;
  displayUrl: string;             // ← always has a value
}

export interface ISetInitialsAvatarRequest {
  color: string;
}

export interface ISetLibraryAvatarRequest {
  avatarId: string;
}

export interface IAvatarOptionsResponse {
  colors: readonly string[];
  libraryAvatars: readonly { id: string; url: string }[];
}