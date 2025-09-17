import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { motion } from 'framer-motion';
import { Eye, EyeOff, LogIn } from 'lucide-react';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    if (signIn) {
      const { error } = await signIn(email, password);
      if (!error) {
        navigate('/');
      }
    } else {
        toast({
            title: "Error de inicialización",
            description: "El servicio de autenticación no está disponible. Por favor, recarga la página.",
            variant: "destructive"
        });
    }
    setIsLoading(false);
  };

  const cardVariants = {
    hidden: { opacity: 0, y: 50 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
  };

  const inputVariants = {
    focus: { scale: 1.02, transition: { duration: 0.2 } },
    blur: { scale: 1 },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-500 via-indigo-600 to-purple-700 flex items-center justify-center p-4">
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
      >
        <Card className="w-full max-w-md shadow-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg">
          <CardHeader className="text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring", stiffness: 120 }}>
              <LogIn className="mx-auto h-16 w-16 text-sky-600 mb-4" />
            </motion.div>
            <CardTitle className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-sky-500 to-indigo-500">
              ¡Bienvenido de Vuelta!
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              Ingresa tus credenciales para acceder a tu LIS.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-slate-700 dark:text-slate-300 font-semibold">Correo Electrónico</Label>
                <motion.div variants={inputVariants} whileFocus="focus" whileTap="focus">
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="bg-white/80 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-sky-500"
                  />
                </motion.div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-700 dark:text-slate-300 font-semibold">Contraseña</Label>
                <motion.div variants={inputVariants} whileFocus="focus" whileTap="focus" className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-white/80 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 focus:border-sky-500 dark:focus:border-sky-500 focus:ring-sky-500 pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-slate-500 hover:text-sky-600"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </Button>
                </motion.div>
              </div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button type="submit" className="w-full bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 text-white font-semibold py-3 text-lg shadow-lg hover:shadow-xl transition-all duration-300" disabled={isLoading}>
                  {isLoading ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"></motion.div>
                  ) : (
                    'Iniciar Sesión'
                  )}
                </Button>
              </motion.div>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col items-center space-y-3 pt-6">
             <Link to="/forgot-password" className="text-sm text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 transition-colors">
              ¿Olvidaste tu contraseña?
            </Link>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              ¿No tienes una cuenta?{' '}
              <Link to="/signup" className="font-medium text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 transition-colors">
                Regístrate
              </Link>
            </p>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
};

export default LoginPage;