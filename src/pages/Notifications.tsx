import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { logout } from "@/store/authSlice";
import { notificationApi } from "@/lib/api";
import { type Notification } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "react-toastify";
import {
  Bell,
  User,
  LayoutDashboard,
  CheckCircle,
  Trash2,
  CheckCheck,
  Filter,
  RefreshCw,
  AlertTriangle,
  Mail,
  Smartphone,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
// Helper function to format relative time
const formatRelativeTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "just now";
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`;
  }
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} hour${hours !== 1 ? "s" : ""} ago`;
  }
  if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} day${days !== 1 ? "s" : ""} ago`;
  }
  if (diffInSeconds < 2592000) {
    const weeks = Math.floor(diffInSeconds / 604800);
    return `${weeks} week${weeks !== 1 ? "s" : ""} ago`;
  }
  return date.toLocaleDateString();
};

type FilterType = "all" | "unread" | "read";

export default function Notifications() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteNotificationId, setDeleteNotificationId] = useState<
    string | null
  >(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadNotifications = useCallback(async () => {
    try {
      setIsLoading(true);
      const params: { is_read?: boolean } = {};
      if (filter === "unread") {
        params.is_read = false;
      } else if (filter === "read") {
        params.is_read = true;
      }

      const [notificationsRes, countRes] = await Promise.all([
        notificationApi.getAll(params),
        notificationApi.getUnreadCount(),
      ]);

      setNotifications(notificationsRes.data.results || notificationsRes.data);
      setUnreadCount(countRes.data.unread_count || 0);
    } catch (error) {
      console.error("Failed to load notifications:", error);
      toast.error("Failed to load notifications");
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadNotifications();
    // Poll for new notifications every 10 seconds
    const interval = setInterval(loadNotifications, 10000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await notificationApi.markRead(notificationId);
      toast.success("Notification marked as read");
      loadNotifications();
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      toast.error("Failed to mark notification as read");
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationApi.markAllRead();
      toast.success("All notifications marked as read");
      loadNotifications();
    } catch (error) {
      console.error("Failed to mark all as read:", error);
      toast.error("Failed to mark all as read");
    }
  };

  const handleDelete = async () => {
    if (!deleteNotificationId) return;

    try {
      setIsDeleting(true);
      await notificationApi.delete(deleteNotificationId);
      toast.success("Notification deleted");
      setShowDeleteModal(false);
      setDeleteNotificationId(null);
      loadNotifications();
    } catch (error) {
      console.error("Failed to delete notification:", error);
      toast.error("Failed to delete notification");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteClick = (notificationId: string) => {
    setDeleteNotificationId(notificationId);
    setShowDeleteModal(true);
  };

  const handleLogout = async () => {
    await dispatch(logout());
    navigate("/login");
  };

  const getNotificationIcon = (notification: Notification) => {
    if (notification.anomaly_type) {
      return <AlertTriangle className="h-5 w-5 text-destructive" />;
    }
    if (notification.notification_type === "email") {
      return <Mail className="h-5 w-5 text-primary" />;
    }
    if (notification.notification_type === "push") {
      return <Smartphone className="h-5 w-5 text-primary" />;
    }
    return <Bell className="h-5 w-5 text-primary" />;
  };

  const filteredNotifications =
    filter === "all"
      ? notifications
      : filter === "unread"
      ? notifications.filter((n) => !n.is_read)
      : notifications.filter((n) => n.is_read);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Notifications
            </h1>
            <p className="text-sm text-muted-foreground">
              Welcome, {user?.username}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="relative">
              <Button
                variant="outline"
                size="icon"
                className="relative"
                onClick={() => navigate("/dashboard")}
              >
                <LayoutDashboard className="h-5 w-5" />
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate("/profile")}
              size="icon"
            >
              <User className="h-5 w-5" />
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden p-6">
        <div className="h-full flex flex-col gap-6">
          {/* Actions Bar */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Notification Center</CardTitle>
                  <CardDescription>
                    {unreadCount > 0
                      ? `${unreadCount} unread notification${
                          unreadCount !== 1 ? "s" : ""
                        }`
                      : "All caught up! No unread notifications"}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={loadNotifications}
                    disabled={isLoading}
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                    />
                  </Button>
                  {unreadCount > 0 && (
                    <Button
                      variant="outline"
                      onClick={handleMarkAllAsRead}
                      className="gap-2"
                    >
                      <CheckCheck className="h-4 w-4" />
                      Mark All Read
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>

          {/* Filter */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Filter className="h-5 w-5 text-muted-foreground" />
                <label className="text-sm font-medium">Filter:</label>
                <Select
                  value={filter}
                  onValueChange={(v) => setFilter(v as FilterType)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter notifications" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Notifications</SelectItem>
                    <SelectItem value="unread">Unread Only</SelectItem>
                    <SelectItem value="read">Read Only</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-sm text-muted-foreground ml-auto">
                  {filteredNotifications.length} notification
                  {filteredNotifications.length !== 1 ? "s" : ""}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Notifications List */}
          <Card className="flex-1 overflow-hidden">
            <CardContent className="p-0 h-full">
              <div className="h-full overflow-y-auto">
                {isLoading && notifications.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
                      <p className="text-sm text-muted-foreground">
                        Loading notifications...
                      </p>
                    </div>
                  </div>
                ) : filteredNotifications.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                      <p className="text-lg font-medium text-foreground mb-2">
                        No notifications
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {filter === "unread"
                          ? "You're all caught up! No unread notifications."
                          : filter === "read"
                          ? "No read notifications found."
                          : "You don't have any notifications yet."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredNotifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-4 hover:bg-accent transition-colors ${
                          !notification.is_read
                            ? "bg-primary/5 dark:bg-primary/10 border-l-4 border-l-primary"
                            : "bg-card"
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          {/* Icon */}
                          <div className="shrink-0 mt-1">
                            {getNotificationIcon(notification)}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3
                                    className={`font-semibold text-sm ${
                                      !notification.is_read
                                        ? "text-foreground"
                                        : "text-muted-foreground"
                                    }`}
                                  >
                                    {notification.title}
                                  </h3>
                                  {!notification.is_read && (
                                    <span className="h-2 w-2 rounded-full bg-primary"></span>
                                  )}
                                </div>
                                <p
                                  className={`text-sm mb-2 ${
                                    !notification.is_read
                                      ? "text-foreground"
                                      : "text-muted-foreground"
                                  }`}
                                >
                                  {notification.message}
                                </p>
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  <span>
                                    {formatRelativeTime(
                                      notification.created_at
                                    )}
                                  </span>
                                  {notification.anomaly_type && (
                                    <span className="px-2 py-1 rounded bg-muted text-muted-foreground">
                                      {notification.anomaly_type}
                                    </span>
                                  )}
                                  <span className="px-2 py-1 rounded bg-muted text-muted-foreground">
                                    {notification.notification_type_display}
                                  </span>
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-2 shrink-0">
                                {!notification.is_read && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() =>
                                      handleMarkAsRead(notification.id)
                                    }
                                    title="Mark as read"
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    handleDeleteClick(notification.id)
                                  }
                                  title="Delete notification"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="bg-card border-border shadow-xl max-w-md">
          <DialogHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-destructive/10">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              <DialogTitle className="text-lg font-semibold text-foreground">
                Delete Notification
              </DialogTitle>
            </div>
            <DialogDescription className="text-muted-foreground">
              Are you sure you want to delete this notification? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteModal(false);
                setDeleteNotificationId(null);
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
