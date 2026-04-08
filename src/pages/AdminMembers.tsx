import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { UserPlus, ShieldCheck, Trash2, Ban, Edit, CheckCircle, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

type Member = {
  user_id: string;
  name: string;
  email: string;
  mobile_number: string;
  created_at: string;
  role?: string;
  is_blocked?: boolean;
};

export default function AdminMembers() {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showCreateAdminPassword, setShowCreateAdminPassword] = useState(false);
  const [promoting, setPromoting] = useState<string | null>(null);
  const [newAdmin, setNewAdmin] = useState({ name: "", email: "", password: "" });

  const [editOpen, setEditOpen] = useState(false);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editMobile, setEditMobile] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchMembers = async () => {
    const { data: profiles } = await supabase.from("profiles").select("*");
    const { data: roles } = await supabase.from("user_roles").select("*");
    if (!profiles) return;
    const roleMap = new Map(roles?.map((r) => [r.user_id, r.role]));
    setMembers(profiles.map((p: any) => ({ ...p, role: roleMap.get(p.user_id) || "member" })));
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("create-admin", {
      body: newAdmin,
    });
    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Failed to create admin");
    } else {
      toast.success("Admin account created successfully!");
      setNewAdmin({ name: "", email: "", password: "" });
      setOpen(false);
      fetchMembers();
    }
    setCreating(false);
  };

  const handlePromote = async (userId: string) => {
    setPromoting(userId);
    const { error } = await supabase.from("user_roles").update({ role: "admin" as const }).eq("user_id", userId);
    if (error) toast.error("Failed to promote member");
    else {
      toast.success("Member promoted to admin!");
      fetchMembers();
    }
    setPromoting(null);
  };

  const handleDemote = async (userId: string) => {
    setPromoting(userId);
    const { error } = await supabase.from("user_roles").update({ role: "member" as const }).eq("user_id", userId);
    if (error) toast.error("Failed to demote admin");
    else {
      toast.success("Admin demoted to member!");
      fetchMembers();
    }
    setPromoting(null);
  };

  const handleBlock = async (userId: string, blocked: boolean) => {
    const { error } = await supabase.from("profiles").update({ is_blocked: !blocked }).eq("user_id", userId);
    if (error) toast.error("Failed to update member status");
    else {
      toast.success(blocked ? "Member unblocked!" : "Member blocked!");
      fetchMembers();
    }
  };

  const handleDelete = async (userId: string) => {
    const { data, error } = await supabase.functions.invoke("delete-member", {
      body: { userId },
    });

    if (error || data?.error) {
      toast.error(data?.error || error?.message || "Failed to remove member");
      return;
    }

    toast.success("Member removed successfully!");
    fetchMembers();
  };

  const openEditDialog = (m: Member) => {
    setEditMember(m);
    setEditName(m.name);
    setEditEmail(m.email);
    setEditMobile(m.mobile_number || "");
    setEditOpen(true);
  };

  const handleEditSave = async () => {
    if (!editMember) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      name: editName,
      email: editEmail,
      mobile_number: editMobile,
    }).eq("user_id", editMember.user_id);
    if (error) toast.error("Failed to update member");
    else {
      toast.success("Member updated!");
      setEditOpen(false);
      fetchMembers();
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[24px] border border-border/70 bg-card/88 p-4 shadow-[0_16px_38px_rgba(16,24,40,0.08)] backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Members ({members.length})</p>
            <p className="mt-1 text-xs text-muted-foreground">Manage roles and access for registered members</p>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="h-11 rounded-2xl px-4">
                <UserPlus className="mr-2 h-4 w-4" />
                Create Admin
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Admin Account</DialogTitle>
                <DialogDescription>Create a new administrator account. The account will be active immediately.</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateAdmin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-name">Full Name</Label>
                  <Input id="admin-name" value={newAdmin.name} onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })} placeholder="Admin name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-email">Email</Label>
                  <Input id="admin-email" type="email" value={newAdmin.email} onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })} placeholder="admin@university.edu" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="admin-password"
                      type={showCreateAdminPassword ? "text" : "password"}
                      value={newAdmin.password}
                      onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                      placeholder="Min 6 characters"
                      required
                      minLength={6}
                      className="pr-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCreateAdminPassword((prev) => !prev)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                      aria-label={showCreateAdminPassword ? "Hide password" : "Show password"}
                    >
                      {showCreateAdminPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={creating}>
                  {creating ? "Creating..." : "Create Admin Account"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Member</DialogTitle>
            <DialogDescription>Update member information</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Mobile Number</Label>
              <Input value={editMobile} onChange={(e) => setEditMobile(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEditSave} disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card className="overflow-hidden rounded-[28px] border border-border/70 bg-card/88 shadow-[0_16px_40px_rgba(16,24,40,0.10)] backdrop-blur-xl">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Members ({members.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => (
                <TableRow key={m.user_id} className={m.is_blocked ? "opacity-50" : ""}>
                  <TableCell className="font-medium">{m.name || "—"}</TableCell>
                  <TableCell>{m.email}</TableCell>
                  <TableCell>
                    <Badge variant={m.role === "admin" ? "default" : "secondary"} className="capitalize">
                      {m.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {m.is_blocked ? (
                      <Badge variant="destructive">Blocked</Badge>
                    ) : (
                      <Badge variant="outline" className="border-green-600 text-green-600">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(m.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {m.user_id !== user?.id && (
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEditDialog(m)} title="Edit">
                          <Edit className="h-4 w-4" />
                        </Button>

                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleBlock(m.user_id, !!m.is_blocked)}
                          title={m.is_blocked ? "Unblock" : "Block"}
                        >
                          {m.is_blocked ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Ban className="h-4 w-4 text-amber-500" />}
                        </Button>

                        {m.role === "admin" ? (
                          <Button size="sm" variant="outline" disabled={promoting === m.user_id} onClick={() => handleDemote(m.user_id)}>
                            {promoting === m.user_id ? "..." : "Demote"}
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" disabled={promoting === m.user_id} onClick={() => handlePromote(m.user_id)}>
                            <ShieldCheck className="mr-1 h-4 w-4" />
                            {promoting === m.user_id ? "..." : "Promote"}
                          </Button>
                        )}

                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" title="Delete">
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Member?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete <strong>{m.name || m.email}</strong>'s profile and role. This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(m.user_id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
