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
import { UserPlus, ShieldCheck, Trash2, Ban, Edit, CheckCircle } from "lucide-react";
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
  const [promoting, setPromoting] = useState<string | null>(null);
  const [newAdmin, setNewAdmin] = useState({ name: "", email: "", password: "" });

  // Edit member state
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

  useEffect(() => { fetchMembers(); }, []);

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
    else { toast.success("Member promoted to admin!"); fetchMembers(); }
    setPromoting(null);
  };

  const handleDemote = async (userId: string) => {
    setPromoting(userId);
    const { error } = await supabase.from("user_roles").update({ role: "member" as const }).eq("user_id", userId);
    if (error) toast.error("Failed to demote admin");
    else { toast.success("Admin demoted to member!"); fetchMembers(); }
    setPromoting(null);
  };

  const handleBlock = async (userId: string, blocked: boolean) => {
    const { error } = await supabase.from("profiles").update({ is_blocked: !blocked }).eq("user_id", userId);
    if (error) toast.error("Failed to update member status");
    else { toast.success(blocked ? "Member unblocked!" : "Member blocked!"); fetchMembers(); }
  };

  const handleDelete = async (userId: string) => {
    const { data, error } = await supabase.functions.invoke("delete-member", {
      body: { userId },
    });
    if (error || data?.error) toast.error(data?.error || error?.message || "Failed to delete member");
    else { toast.success("Member deleted!"); fetchMembers(); }
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
    else { toast.success("Member updated!"); setEditOpen(false); fetchMembers(); }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Members</h1>
          <p className="text-muted-foreground">All registered fund members</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
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
                <Input id="admin-password" type="password" value={newAdmin.password} onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })} placeholder="Min 6 characters" required minLength={6} />
              </div>
              <Button type="submit" className="w-full" disabled={creating}>
                {creating ? "Creating..." : "Create Admin Account"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Member Dialog */}
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

      <Card>
        <CardHeader>
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
                      <Badge variant="outline" className="text-green-600 border-green-600">Active</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {new Date(m.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {m.user_id !== user?.id && (
                      <div className="flex items-center justify-end gap-1">
                        {/* Edit */}
                        <Button size="icon" variant="ghost" onClick={() => openEditDialog(m)} title="Edit">
                          <Edit className="h-4 w-4" />
                        </Button>

                        {/* Block/Unblock */}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleBlock(m.user_id, !!m.is_blocked)}
                          title={m.is_blocked ? "Unblock" : "Block"}
                        >
                          {m.is_blocked ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Ban className="h-4 w-4 text-amber-500" />}
                        </Button>

                        {/* Promote/Demote */}
                        {m.role === "admin" ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={promoting === m.user_id}
                            onClick={() => handleDemote(m.user_id)}
                          >
                            {promoting === m.user_id ? "..." : "Demote"}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={promoting === m.user_id}
                            onClick={() => handlePromote(m.user_id)}
                          >
                            <ShieldCheck className="mr-1 h-4 w-4" />
                            {promoting === m.user_id ? "..." : "Promote"}
                          </Button>
                        )}

                        {/* Delete */}
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
