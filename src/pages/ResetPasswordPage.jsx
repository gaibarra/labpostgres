import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { motion } from 'framer-motion';
import { KeyRound, Eye, EyeOff, CheckCircle } from 'lucide-react';

const ResetPasswordPage = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPasswordUpdated, setIsPasswordUpdated] = useState(false);
  const { updatePassword, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const location = useLocation();

  useEffect(() => {
    const hash = location.hash;
    if (!hash.includes('type=recovery') && !user) {
        toast({
            title: "Acceso Inválido",
            description: "Este enlace de restablecimiento no es válido o ha expirado. Por favor, solicita uno nuevo.",
            variant: "destructive",
            duration: 7000,
        });
        navigate('/login');
    }
  }, [location, navigate, toast, user]);


  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({
        title: "Error de Contraseña",
        description: "Las contraseñas no coinciden.",
        variant: "destructive",
      });
      return;
    }
    if (password.length < 6) {
      toast({
        title: "Contraseña Débil",
        description: "La contraseña debe tener al menos 6 caracteres.",
        variant: "destructive",
      });
      return;
    }
    setIsLoading(true);
    const { error } = await updatePassword(password);
    setIsLoading(false);
    if (!error) {
      toast({
        title: "¡Contraseña Actualizada!",
        description: "Tu contraseña ha sido cambiada exitosamente. Ahora puedes iniciar sesión.",
        variant: "success",
        duration: 5000,
      });
      setIsPasswordUpdated(true);
      setTimeout(() => navigate('/login'), 3000);
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
  };

  const inputVariants = {
    focus: { scale: 1.02, transition: { duration: 0.2 } },
    blur: { scale: 1 },
  };

  if (isPasswordUpdated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-400 via-emerald-500 to-teal-600 flex items-center justify-center p-4">
        <motion.div variants={cardVariants} initial="hidden" animate="visible">
          <Card className="w-full max-w-md shadow-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg text-center">
            <CardHeader>
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring", stiffness: 120 }}>
                <CheckCircle className="mx-auto h-20 w-20 text-emerald-500 mb-4" />
              </motion.div>
              <CardTitle className="text-3xl font-bold text-emerald-600">¡Éxito!</CardTitle>
              <CardDescription className="text-slate-600 dark:text-slate-400 text-lg mt-2">
                Tu contraseña ha sido actualizada. Serás redirigido al inicio de sesión en unos segundos.
              </CardDescription>
            </CardHeader>
          </Card>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-rose-600 flex items-center justify-center p-4">
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
      >
        <Card className="w-full max-w-md shadow-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg">
          <CardHeader className="text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring", stiffness: 120 }}>
              <KeyRound className="mx-auto h-16 w-16 text-pink-600 mb-4" />
            </motion.div>
            <CardTitle className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-rose-500">
              Restablecer Contraseña
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              Ingresa tu nueva contraseña a continuación.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-1">
                <Label htmlFor="password" className="text-slate-700 dark:text-slate-300 font-semibold">Nueva Contraseña</Label>
                <motion.div variants={inputVariants} whileFocus="focus" whileTap="focus" className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-white/80 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 focus:border-pink-500 dark:focus:border-pink-500 focus:ring-pink-500 pr-10"
                  />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-slate-500 hover:text-pink-600" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </Button>
                </motion.div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="confirmPassword" className="text-slate-700 dark:text-slate-300 font-semibold">Confirmar Nueva Contraseña</Label>
                <motion.div variants={inputVariants} whileFocus="focus" whileTap="focus" className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Repite tu nueva contraseña"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="bg-white/80 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 focus:border-pink-500 dark:focus:border-pink-500 focus:ring-pink-500 pr-10"
                  />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-slate-500 hover:text-pink-600" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </Button>
                </motion.div>
              </div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="pt-2">
                <Button type="submit" className="w-full bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white font-semibold py-3 text-lg shadow-lg hover:shadow-xl transition-all duration-300" disabled={isLoading}>
                  {isLoading ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"></motion.div>
                  ) : (
                    'Actualizar Contraseña'
                  )}
                </Button>
              </motion.div>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default ResetPasswordPage;