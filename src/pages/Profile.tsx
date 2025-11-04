import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { logout, fetchCurrentUser } from "@/store/authSlice";
import { userApi, notificationApi } from "@/lib/api";
import { type Notification } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "react-toastify";
import { User as UserIcon, Key, Save, Bell, Trash2 } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const profileSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  email: z.string().email("Invalid email address"),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
});

const passwordSchema = z
  .object({
    current_password: z.string().min(1, "Current password is required"),
    new_password: z.string().min(8, "Password must be at least 8 characters"),
    re_new_password: z.string().min(8, "Please confirm your password"),
  })
  .refine((data) => data.new_password === data.re_new_password, {
    message: "Passwords don't match",
    path: ["re_new_password"],
  });

type ProfileFormValues = z.infer<typeof profileSchema>;
type PasswordFormValues = z.infer<typeof passwordSchema>;

export default function Profile() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { user } = useAppSelector((state) => state.auth);
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordLoading, setIsPasswordLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    try {
      const response = await notificationApi.getAll({ is_read: false });
      setNotifications(response.data.results || response.data);
    } catch (error) {
      console.error("Failed to load notifications:", error);
    }
  };

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      username: user?.username || "",
      email: user?.email || "",
      first_name: user?.first_name || "",
      last_name: user?.last_name || "",
    },
  });

  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      current_password: "",
      new_password: "",
      re_new_password: "",
    },
  });

  useEffect(() => {
    if (user) {
      profileForm.reset({
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
      });
    }
  }, [user, profileForm]);

  const onProfileSubmit = async (data: ProfileFormValues) => {
    setIsLoading(true);
    try {
      const response = await userApi.updateProfile(data);
      // Update Redux store with new user data
      await dispatch(fetchCurrentUser()).unwrap();
      // Reset form with updated data
      profileForm.reset({
        username: response.data.username || data.username,
        email: response.data.email || data.email,
        first_name: response.data.first_name || data.first_name,
        last_name: response.data.last_name || data.last_name,
      });
      toast.success("Profile updated successfully!");
    } catch (error: unknown) {
      console.error("Profile update error:", error);
      if (
        error &&
        typeof error === "object" &&
        "response" in error &&
        error.response &&
        typeof error.response === "object" &&
        "data" in error.response
      ) {
        const errorData = error.response.data as Record<string, unknown>;
        // Extract error messages from backend
        if (typeof errorData === "object" && errorData !== null) {
          const errorMessages = Object.values(errorData)
            .flat()
            .filter((msg) => typeof msg === "string");
          if (errorMessages.length > 0) {
            toast.error(errorMessages[0] || "Failed to update profile");
          } else {
            toast.error("Failed to update profile");
          }
        } else {
          toast.error("Failed to update profile");
        }
      } else {
        toast.error("Failed to update profile");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onPasswordSubmit = async (data: PasswordFormValues) => {
    setIsPasswordLoading(true);
    try {
      await userApi.setPassword({
        current_password: data.current_password,
        new_password: data.new_password,
        re_new_password: data.re_new_password,
      });
      toast.success("Password changed successfully!");
      passwordForm.reset();
    } catch (error: unknown) {
      console.error("Password change error:", error);
      if (
        error &&
        typeof error === "object" &&
        "response" in error &&
        error.response &&
        typeof error.response === "object" &&
        "data" in error.response
      ) {
        const errorData = error.response.data as Record<string, unknown>;
        // Extract error messages from backend
        if (typeof errorData === "object" && errorData !== null) {
          const errorMessages = Object.values(errorData)
            .flat()
            .filter((msg) => typeof msg === "string");
          if (errorMessages.length > 0) {
            toast.error(errorMessages[0] || "Failed to change password");
          } else {
            toast.error("Failed to change password");
          }
        } else {
          toast.error("Failed to change password");
        }
      } else {
        toast.error("Failed to change password");
      }
    } finally {
      setIsPasswordLoading(false);
    }
  };

  const handleDeleteAccountClick = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setShowDeleteModal(true);
    setDeleteConfirmText("");
  };

  const handleDeleteAccount = async () => {
    // Validate confirmation text
    if (deleteConfirmText.trim() !== "DELETE") {
      toast.error('Please type "DELETE" exactly to confirm account deletion');
      return;
    }

    setIsDeleting(true);
    try {
      const response = await userApi.deleteAccount();
      console.log("Delete account response:", response);

      // Only show success if we get a successful response
      if (response.status === 204 || response.status === 200) {
        toast.success("Account deleted successfully");
        // Close modal before redirecting
        setShowDeleteModal(false);
        setDeleteConfirmText("");
        // Small delay to show success message
        setTimeout(async () => {
          await dispatch(logout());
          navigate("/login");
        }, 500);
      }
    } catch (error: unknown) {
      console.error("Delete account error:", error);
      console.error(
        "Error response data:",
        (error as { response?: { data?: unknown } })?.response?.data
      );

      // Handle Axios errors
      if (
        error &&
        typeof error === "object" &&
        "response" in error &&
        error.response &&
        typeof error.response === "object"
      ) {
        const axiosError = error as {
          response?: {
            status?: number;
            data?: unknown;
            statusText?: string;
          };
          message?: string;
        };

        // 204 No Content is actually a success for DELETE
        if (axiosError.response?.status === 204) {
          toast.success("Account deleted successfully");
          setShowDeleteModal(false);
          setDeleteConfirmText("");
          setTimeout(async () => {
            await dispatch(logout());
            navigate("/login");
          }, 500);
          return;
        }

        // Extract error message from response
        if (axiosError.response && "data" in axiosError.response) {
          const errorData = axiosError.response.data;
          console.error("Full error data:", errorData);

          // Handle different error response formats
          if (typeof errorData === "object" && errorData !== null) {
            const errorObj = errorData as Record<string, unknown>;

            // Check for detail field (common in REST APIs)
            if ("detail" in errorObj && typeof errorObj.detail === "string") {
              toast.error(errorObj.detail);
            }
            // Check for non_field_errors (Django REST Framework)
            else if (
              "non_field_errors" in errorObj &&
              Array.isArray(errorObj.non_field_errors)
            ) {
              const messages = errorObj.non_field_errors.filter(
                (msg) => typeof msg === "string"
              );
              if (messages.length > 0) {
                toast.error(messages[0]);
              } else {
                toast.error("Failed to delete account. Please try again.");
              }
            }
            // Try to extract any error messages from all fields
            else {
              const errorMessages = Object.values(errorObj)
                .flat()
                .filter((msg) => typeof msg === "string");
              if (errorMessages.length > 0) {
                toast.error(errorMessages[0]);
              } else {
                // Try to stringify the error object for debugging
                const errorString = JSON.stringify(errorObj);
                console.error("Error object:", errorString);
                toast.error(
                  axiosError.response?.statusText ||
                    "Failed to delete account. Please check console for details."
                );
              }
            }
          } else if (typeof errorData === "string") {
            toast.error(errorData);
          } else {
            toast.error(
              axiosError.response?.statusText ||
                "Failed to delete account. Please try again."
            );
          }
        } else {
          toast.error(
            axiosError.response?.statusText ||
              "Failed to delete account. Please try again."
          );
        }
      } else if (error && typeof error === "object" && "message" in error) {
        toast.error(String(error.message) || "Failed to delete account");
      } else {
        toast.error("Failed to delete account. Please try again.");
      }
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLogout = async () => {
    await dispatch(logout());
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card border-b border-border px-6 py-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">User Profile</h1>
            <p className="text-sm text-muted-foreground">
              Manage your account settings
            </p>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <div className="relative">
              <Button variant="outline" size="icon" className="relative">
                <Bell className="h-5 w-5" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {notifications.length}
                  </span>
                )}
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate("/dashboard")}
              size="icon"
            >
              <UserIcon className="h-5 w-5" />
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Profile Information */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <UserIcon className="h-5 w-5 text-foreground" />
              <CardTitle className="text-foreground">
                Profile Information
              </CardTitle>
            </div>
            <CardDescription className="text-muted-foreground">
              Update your personal information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...profileForm}>
              <form
                onSubmit={profileForm.handleSubmit(onProfileSubmit)}
                className="space-y-4"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={profileForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input placeholder="Username" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={profileForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="Email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={profileForm.control}
                    name="first_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input placeholder="First Name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={profileForm.control}
                    name="last_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Last Name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <Button type="submit" disabled={isLoading}>
                  <Save className="h-4 w-4 mr-2" />
                  {isLoading ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              <CardTitle>Change Password</CardTitle>
            </div>
            <CardDescription>
              Update your password to keep your account secure
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...passwordForm}>
              <form
                onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={passwordForm.control}
                  name="current_password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Current password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="new_password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="New password"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Password must be at least 8 characters long
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="re_new_password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Confirm new password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" disabled={isPasswordLoading}>
                  <Key className="h-4 w-4 mr-2" />
                  {isPasswordLoading ? "Changing..." : "Change Password"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Account Actions */}
        <Card className="border-red-200 dark:border-red-800">
          <CardHeader>
            <CardTitle className="text-red-600 dark:text-red-400">
              Danger Zone
            </CardTitle>
            <CardDescription>
              Irreversible and destructive actions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Delete Account</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Once you delete your account, there is no going back. Please
                  be certain.
                </p>
              </div>
              <Button
                type="button"
                variant="destructive"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleDeleteAccountClick(e);
                }}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Delete Account Modal */}
      <Dialog open={showDeleteModal} onOpenChange={setShowDeleteModal}>
        <DialogContent className="bg-white/90 border-border shadow-xl max-w-md">
          <DialogHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-red-100 dark:bg-red-900/20 p-2">
                <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <DialogTitle className="text-xl font-semibold text-foreground">
                Delete Account
              </DialogTitle>
            </div>
            <DialogDescription className="text-base text-muted-foreground pt-2">
              This action cannot be undone. This will permanently delete your
              account and remove all your data from our servers. Please type{" "}
              <strong className="text-foreground font-semibold">DELETE</strong>{" "}
              to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-lg border border-border bg-background p-4">
              <label
                htmlFor="delete-confirm"
                className="block text-sm font-medium text-foreground mb-2"
              >
                Confirmation Text
              </label>
              <Input
                id="delete-confirm"
                type="text"
                placeholder="Type DELETE to confirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    deleteConfirmText === "DELETE" &&
                    !isDeleting
                  ) {
                    handleDeleteAccount();
                  }
                }}
                className="w-full bg-background border-input text-foreground placeholder:text-muted-foreground focus:ring-2 focus:ring-red-500 focus:border-red-500"
                autoFocus
              />
              {deleteConfirmText && deleteConfirmText !== "DELETE" && (
                <p className="text-sm text-muted-foreground mt-2">
                  Please type exactly: <strong>DELETE</strong>
                </p>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteModal(false);
                setDeleteConfirmText("");
              }}
              disabled={isDeleting}
              className="border-border hover:bg-accent"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleDeleteAccount();
              }}
              disabled={deleteConfirmText !== "DELETE" || isDeleting}
              className="bg-red-600 hover:bg-red-700 dark:bg-red-600 dark:hover:bg-red-700 text-white shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDeleting ? (
                <>
                  <span className="animate-spin mr-2">⏳</span>
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Account
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
