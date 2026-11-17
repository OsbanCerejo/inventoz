import { useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  Box, Button, CircularProgress, IconButton, InputAdornment,
  Stack, TextField, Typography,
} from "@mui/material";
import LockIcon from "@mui/icons-material/Lock";
import LunchDiningIcon from "@mui/icons-material/LunchDining";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { getApiUrl } from "../config/api";

interface Props {
  releaseAt: string | null;
  onUnlocked: () => void;
}

function useCountdown(releaseAt: string | null) {
  const [remaining, setRemaining] = useState("");
  useEffect(() => {
    if (!releaseAt) { setRemaining(""); return; }
    const tick = () => {
      const diff = new Date(releaseAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining("00:00"); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [releaseAt]);
  return remaining;
}

export default function LunchModeOverlay({ releaseAt, onUnlocked }: Props) {
  const [managerId, setManagerId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const countdown = useCountdown(releaseAt);
  const passwordRef = useRef<HTMLInputElement>(null);

  const handleUnlock = async () => {
    if (!managerId || !password) { setError("Enter manager ID and password"); return; }
    setLoading(true); setError(null);
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        getApiUrl("lunch-mode/unlock"),
        { managerId: Number(managerId), managerPassword: password },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      onUnlocked();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Unlock failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        bgcolor: "rgba(10, 25, 47, 0.97)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        p: 3,
        backdropFilter: "blur(6px)",
      }}
    >
      <Stack spacing={3} alignItems="center" sx={{ maxWidth: 420, width: "100%" }}>
        {/* Icon */}
        <Box sx={{ position: "relative" }}>
          <LunchDiningIcon sx={{ fontSize: 72, color: "#f59e0b" }} />
          <LockIcon sx={{ position: "absolute", bottom: -4, right: -8, fontSize: 28, color: "#64748b" }} />
        </Box>

        {/* Headline */}
        <Typography variant="h3" sx={{ fontWeight: 800, color: "#f8fafc", textAlign: "center", letterSpacing: -0.5 }}>
          Time For A Break
        </Typography>
        <Typography variant="body1" sx={{ color: "#94a3b8", textAlign: "center" }}>
          Step away and enjoy your lunch. Your screen will unlock automatically at 2:00 PM EST.
        </Typography>

        {/* Countdown */}
        {countdown && (
          <Box
            sx={{
              bgcolor: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 2,
              px: 4, py: 2,
              textAlign: "center",
            }}
          >
            <Typography variant="caption" sx={{ color: "#64748b", display: "block", mb: 0.5 }}>
              AUTO-UNLOCK IN
            </Typography>
            <Typography variant="h4" sx={{ color: "#f8fafc", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
              {countdown}
            </Typography>
          </Box>
        )}

        {/* Divider */}
        <Box sx={{ width: "100%", display: "flex", alignItems: "center", gap: 1 }}>
          <Box sx={{ flex: 1, height: 1, bgcolor: "rgba(255,255,255,0.08)" }} />
          <Typography variant="caption" sx={{ color: "#475569" }}>OR MANAGER UNLOCK</Typography>
          <Box sx={{ flex: 1, height: 1, bgcolor: "rgba(255,255,255,0.08)" }} />
        </Box>

        {/* Unlock form */}
        <Stack spacing={1.5} sx={{ width: "100%" }}>
          <TextField
            label="Manager User ID"
            type="number"
            value={managerId}
            onChange={e => setManagerId(e.target.value)}
            size="small"
            fullWidth
            sx={inputSx}
            inputProps={{ min: 1 }}
          />
          <TextField
            inputRef={passwordRef}
            label="Manager Password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") handleUnlock(); }}
            size="small"
            fullWidth
            sx={inputSx}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(v => !v)} edge="end" sx={{ color: "#64748b" }}>
                    {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          {error && (
            <Typography variant="caption" sx={{ color: "#f87171" }}>{error}</Typography>
          )}
          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={handleUnlock}
            disabled={loading}
            sx={{
              bgcolor: "#1d4ed8", "&:hover": { bgcolor: "#1e40af" },
              color: "#fff", fontWeight: 700, borderRadius: 1.5,
            }}
          >
            {loading ? <CircularProgress size={22} sx={{ color: "#fff" }} /> : "Unlock"}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

const inputSx = {
  "& .MuiOutlinedInput-root": {
    bgcolor: "rgba(255,255,255,0.05)",
    "& fieldset": { borderColor: "rgba(255,255,255,0.12)" },
    "&:hover fieldset": { borderColor: "rgba(255,255,255,0.25)" },
    "&.Mui-focused fieldset": { borderColor: "#3b82f6" },
  },
  "& .MuiInputLabel-root": { color: "#64748b" },
  "& .MuiInputBase-input": { color: "#f8fafc" },
};
