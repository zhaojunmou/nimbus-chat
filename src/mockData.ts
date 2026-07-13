import type { Conversation, Contact, Message, NotificationItem } from "./types";

// 会话列表（侧边栏 6 条 + 对话详情入口）
export const conversations: Conversation[] = [
  {
    id: "alex",
    name: "Alex Chen",
    initials: "AC",
    color: "brand",
    lastMessage: "Hey, did you check the new API docs?",
    lastTime: "2m",
    unreadCount: 3,
    isOnline: true,
  },
  {
    id: "design-team",
    name: "Design Team",
    initials: "DT",
    color: "violet",
    lastMessage: "Sarah: Updated the mockups for v2",
    lastTime: "15m",
    unreadCount: 0,
    isOnline: false,
    isGroup: true,
  },
  {
    id: "maya",
    name: "Maya Rodriguez",
    initials: "MR",
    color: "coral",
    lastMessage: "The deployment is done",
    lastTime: "1h",
    unreadCount: 1,
    isOnline: true,
  },
  {
    id: "project-alpha",
    name: "Project Alpha",
    initials: "PA",
    color: "amber",
    lastMessage: "Files uploaded to shared drive",
    lastTime: "3h",
    unreadCount: 0,
    isOnline: false,
    isGroup: true,
  },
  {
    id: "liam",
    name: "Liam Foster",
    initials: "LF",
    color: "cyan",
    lastMessage: "Can we sync tomorrow morning?",
    lastTime: "Yesterday",
    unreadCount: 0,
    isOnline: true,
  },
  {
    id: "engineering",
    name: "Engineering",
    initials: "EN",
    color: "teal",
    lastMessage: "Build #4521 passed all tests",
    lastTime: "Yesterday",
    unreadCount: 0,
    isOnline: false,
    isGroup: true,
  },
];

// 对话详情消息（Alex Chen）— 仅作前端兜底，实际数据来自后端
export const messages: Message[] = [
  { id: "m1", conversationId: "alex", senderId: "alex", text: "Hey! Did you get a chance to review the API docs I sent over?", isSent: false, timestamp: "10:24 AM", isRead: true },
  { id: "m2", conversationId: "alex", senderId: "you", text: "Yes, just went through them. The WebSocket implementation looks solid.", isSent: true, timestamp: "10:26 AM", isRead: true },
  { id: "m3", conversationId: "alex", senderId: "alex", text: "Great! I was thinking we could add a reconnection strategy with exponential backoff.", isSent: false, timestamp: "10:27 AM", isRead: true },
  { id: "m4", conversationId: "alex", senderId: "you", text: "That's a good idea. I can draft something up this afternoon. Any specific retry limits in mind?", isSent: true, timestamp: "10:30 AM", isRead: true },
  { id: "m5", conversationId: "alex", senderId: "alex", text: "Let's cap it at 5 retries with a max delay of 30 seconds. Also we should make sure the design tokens are documented properly.", isSent: false, timestamp: "10:32 AM", isRead: true },
  { id: "m6", conversationId: "alex", senderId: "you", text: "Agreed. I'll also add a section on the new design tokens we shipped last week.", isSent: true, timestamp: "10:35 AM", isRead: true },
  { id: "m7", conversationId: "alex", senderId: "alex", text: "Perfect. One more thing — can we sync on the auth flow tomorrow? I have some thoughts on the token refresh logic.", isSent: false, timestamp: "10:38 AM", isRead: true },
  { id: "m8", conversationId: "alex", senderId: "you", text: "Sure, I'm free after 2pm. Let's do a quick call then.", isSent: true, timestamp: "10:40 AM", isRead: true },
];

// 联系人列表（按字母分组）
export const contacts: Contact[] = [
  { id: "alex", name: "Alex Chen", initials: "AC", color: "brand", isOnline: true, lastSeen: "Online", email: "alex.chen@techcorp.com", phone: "+1 (555) 0456", location: "San Francisco, CA", bio: "Building beautiful interfaces. Coffee enthusiast.", role: "Product Designer at TechCorp" },
  { id: "anna", name: "Anna Kim", initials: "AK", color: "cyan", isOnline: false, lastSeen: "1h ago" },
  { id: "design-team", name: "Design Team", initials: "DT", color: "violet", isOnline: false, lastSeen: "5 members", isGroup: true, memberCount: 5 },
  { id: "engineering", name: "Engineering", initials: "EN", color: "teal", isOnline: false, lastSeen: "12 members", isGroup: true, memberCount: 12 },
  { id: "emily", name: "Emily Park", initials: "EP", color: "coral", isOnline: true, lastSeen: "Online" },
  { id: "james", name: "James Liu", initials: "JL", color: "amber", isOnline: false, lastSeen: "Yesterday" },
  { id: "liam", name: "Liam Foster", initials: "LF", color: "cyan", isOnline: false, lastSeen: "3h ago" },
  { id: "maya", name: "Maya Rodriguez", initials: "MR", color: "coral", isOnline: true, lastSeen: "Online" },
  { id: "project-alpha", name: "Project Alpha", initials: "PA", color: "amber", isOnline: false, lastSeen: "8 members", isGroup: true, memberCount: 8 },
  { id: "sarah", name: "Sarah Miller", initials: "SM", color: "brand", isOnline: true, lastSeen: "Online" },
  { id: "tom", name: "Tom Wilson", initials: "TW", color: "violet", isOnline: false, lastSeen: "Offline" },
];

// 通知列表
export const notifications: NotificationItem[] = [
  { id: "n1", actorName: "Alex Chen", actorInitials: "AC", actorColor: "brand", action: "sent you a message", content: "Hey, did you check the new API docs?", timestamp: "2m ago", isRead: false, type: "message" },
  { id: "n2", actorName: "Maya Rodriguez", actorInitials: "MR", actorColor: "coral", action: "mentioned you", content: "@You can you review the PR when you have a moment?", timestamp: "15m ago", isRead: false, type: "mention" },
  { id: "n3", actorName: "Sarah Miller", actorInitials: "SM", actorColor: "brand", action: "reacted to your message", content: "👍 \"Let's ship it!\"", timestamp: "1h ago", isRead: false, type: "reaction" },
  { id: "n4", actorName: "Design Team", actorInitials: "DT", actorColor: "violet", action: "new message in group", content: "Sarah: Updated the mockups for v2", timestamp: "2h ago", isRead: true, type: "group" },
  { id: "n5", actorName: "Engineering", actorInitials: "EN", actorColor: "teal", action: "new build notification", content: "Build #4521 passed all tests", timestamp: "5h ago", isRead: true, type: "system" },
  { id: "n6", actorName: "Liam Foster", actorInitials: "LF", actorColor: "cyan", action: "sent you a message", content: "Can we sync tomorrow morning?", timestamp: "Yesterday", isRead: true, type: "message" },
  { id: "n7", actorName: "Project Alpha", actorInitials: "PA", actorColor: "amber", action: "files shared in group", content: "3 files uploaded to shared drive", timestamp: "Yesterday", isRead: true, type: "group" },
];

// 当前用户
export const currentUser = {
  id: "you",
  displayName: "You",
  email: "you@nimbus.chat",
  initials: "Y",
  color: "brand" as const,
  statusMessage: "Available",
  bio: "Hey there! I'm using Nimbus Chat.",
  phone: "+1 (555) 0123",
};
