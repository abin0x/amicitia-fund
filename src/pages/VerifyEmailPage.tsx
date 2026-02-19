import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2, Landmark } from "lucide-react";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      setStatus("error");
      setMessage("No verification token found.");
      return;
    }

    const verify = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("verify-email", {
          body: { token },
        });
        if (error) throw error;
        if (data?.success) {
          setStatus("success");
          setMessage(data.already_verified ? "Your email is already verified!" : "Your email has been verified successfully!");
        } else {
          setStatus("error");
          setMessage(data?.error || "Verification failed.");
        }
      } catch (err: any) {
        setStatus("error");
        setMessage(err.message || "Something went wrong.");
      }
    };
    verify();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md shadow-xl border-border/50 text-center">
        <CardHeader className="space-y-3">
          <div className="mx-auto w-14 h-14 rounded-xl bg-primary flex items-center justify-center">
            <Landmark className="w-7 h-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">Email Verification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "loading" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-muted-foreground">Verifying your email...</p>
            </div>
          )}
          {status === "success" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle className="w-12 h-12 text-green-500" />
              <p className="font-medium text-lg">{message}</p>
              <Button onClick={() => navigate("/auth")} className="mt-2">Go to Login</Button>
            </div>
          )}
          {status === "error" && (
            <div className="flex flex-col items-center gap-3 py-4">
              <XCircle className="w-12 h-12 text-destructive" />
              <p className="font-medium text-lg">{message}</p>
              <Button variant="outline" onClick={() => navigate("/auth")} className="mt-2">Back to Login</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
