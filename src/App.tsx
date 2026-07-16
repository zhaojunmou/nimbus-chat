import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import ChatMain from "@/pages/ChatMain";
import ConversationDetail from "@/pages/ConversationDetail";
import VoiceCall from "@/pages/VoiceCall";
import ContactsManagement from "@/pages/ContactsManagement";
import AddContact from "@/pages/AddContact";
import ContactProfile from "@/pages/ContactProfile";
import CreateGroup from "@/pages/CreateGroup";
import GroupDetail from "@/pages/GroupDetail";
import SearchNotifications from "@/pages/SearchNotifications";
import SettingsProfile from "@/pages/SettingsProfile";
import EditProfile from "@/pages/EditProfile";
import PrivacySecurity from "@/pages/PrivacySecurity";
import StorageData from "@/pages/StorageData";
import FilesManagement from "@/pages/FilesManagement";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminConversations from "@/pages/admin/AdminConversations";
import AdminMessages from "@/pages/admin/AdminMessages";
import AdminContacts from "@/pages/admin/AdminContacts";
import AdminNotifications from "@/pages/admin/AdminNotifications";
import AdminFriendRequests from "@/pages/admin/AdminFriendRequests";
import { useAppStore } from "@/store";
import { IncomingCallDialog } from "@/components/IncomingCallDialog";

/** 路由守卫 — 未登录跳转 /login，认证初始化中显示 loading */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const authReady = useAppStore((s) => s.authReady);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);

  if (!authReady) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-bg-base-default">
        <Loader2 size={28} className="text-brand animate-spin" />
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

/** 管理员路由守卫 — 需登录且 role === "admin" */
function RequireAdmin({ children }: { children: React.ReactNode }) {
  const authReady = useAppStore((s) => s.authReady);
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);
  const user = useAppStore((s) => s.user);

  if (!authReady) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-bg-base-default">
        <Loader2 size={28} className="text-brand animate-spin" />
      </div>
    );
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  if (user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <Router>
      <IncomingCallDialog />
      <Routes>
        {/* 认证页（无需登录） */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* 业务页面（需登录） */}
        <Route
          path="/"
          element={
            <RequireAuth>
              <ChatMain />
            </RequireAuth>
          }
        />
        <Route
          path="/chat/:id"
          element={
            <RequireAuth>
              <ConversationDetail />
            </RequireAuth>
          }
        />
        <Route
          path="/call/:id"
          element={
            <RequireAuth>
              <VoiceCall />
            </RequireAuth>
          }
        />
        <Route
          path="/contacts"
          element={
            <RequireAuth>
              <ContactsManagement />
            </RequireAuth>
          }
        />
        <Route
          path="/contacts/add"
          element={
            <RequireAuth>
              <AddContact />
            </RequireAuth>
          }
        />
        <Route
          path="/contacts/:id"
          element={
            <RequireAuth>
              <ContactProfile />
            </RequireAuth>
          }
        />
        <Route
          path="/groups/new"
          element={
            <RequireAuth>
              <CreateGroup />
            </RequireAuth>
          }
        />
        <Route
          path="/groups/:id"
          element={
            <RequireAuth>
              <GroupDetail />
            </RequireAuth>
          }
        />
        <Route
          path="/notifications"
          element={
            <RequireAuth>
              <SearchNotifications />
            </RequireAuth>
          }
        />
        <Route
          path="/settings"
          element={
            <RequireAuth>
              <SettingsProfile />
            </RequireAuth>
          }
        />
        <Route
          path="/settings/profile"
          element={
            <RequireAuth>
              <EditProfile />
            </RequireAuth>
          }
        />
        <Route
          path="/settings/privacy"
          element={
            <RequireAuth>
              <PrivacySecurity />
            </RequireAuth>
          }
        />
        <Route
          path="/settings/storage"
          element={
            <RequireAuth>
              <StorageData />
            </RequireAuth>
          }
        />
        <Route
          path="/files"
          element={
            <RequireAuth>
              <FilesManagement />
            </RequireAuth>
          }
        />

        {/* 管理后台（需管理员权限） */}
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminDashboard />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/users"
          element={
            <RequireAdmin>
              <AdminUsers />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/conversations"
          element={
            <RequireAdmin>
              <AdminConversations />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/messages"
          element={
            <RequireAdmin>
              <AdminMessages />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/contacts"
          element={
            <RequireAdmin>
              <AdminContacts />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/notifications"
          element={
            <RequireAdmin>
              <AdminNotifications />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/friend-requests"
          element={
            <RequireAdmin>
              <AdminFriendRequests />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
