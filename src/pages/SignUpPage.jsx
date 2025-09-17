import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { motion } from 'framer-motion';
import { UserPlus, Eye, EyeOff } from 'lucide-react';

const SignUpPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

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
    const { error } = await signUp(email, password, firstName, lastName);
    setIsLoading(false);
    if (!error) {
      toast({
        title: "¡Registro Exitoso!",
        description: "Ahora puedes iniciar sesión.",
        variant: "success",
        duration: 5000,
      });
      navigate('/login');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-400 via-teal-500 to-cyan-600 flex items-center justify-center p-4">
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
      >
        <Card className="w-full max-w-lg shadow-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg">
          <CardHeader className="text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring", stiffness: 120 }}>
              <UserPlus className="mx-auto h-16 w-16 text-teal-600 mb-4" />
            </motion.div>
            <CardTitle className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-teal-500 to-cyan-500">
              Crear Nueva Cuenta
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              Completa el formulario para unirte a nuestra plataforma.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label htmlFor="firstName" className="text-slate-700 dark:text-slate-300 font-semibold">Nombre</Label>
                  <motion.div variants={inputVariants} whileFocus="focus" whileTap="focus">
                    <Input id="firstName" type="text" placeholder="Tu Nombre" value={firstName} onChange={(e) => setFirstName(e.target.value)} required 
                           className="bg-white/80 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 focus:border-teal-500 dark:focus:border-teal-500 focus:ring-teal-500"/>
                  </motion.div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="lastName" className="text-slate-700 dark:text-slate-300 font-semibold">Apellido</Label>
                  <motion.div variants={inputVariants} whileFocus="focus" whileTap="focus">
                    <Input id="lastName" type="text" placeholder="Tu Apellido" value={lastName} onChange={(e) => setLastName(e.target.value)} required 
                           className="bg-white/80 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 focus:border-teal-500 dark:focus:border-teal-500 focus:ring-teal-500"/>
                  </motion.div>
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="email" className="text-slate-700 dark:text-slate-300 font-semibold">Correo Electrónico</Label>
                <motion.div variants={inputVariants} whileFocus="focus" whileTap="focus">
                  <Input id="email" type="email" placeholder="tu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} required 
                         className="bg-white/80 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 focus:border-teal-500 dark:focus:border-teal-500 focus:ring-teal-500"/>
                </motion.div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="password" className="text-slate-700 dark:text-slate-300 font-semibold">Contraseña</Label>
                <motion.div variants={inputVariants} whileFocus="focus" whileTap="focus" className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 6 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="bg-white/80 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 focus:border-teal-500 dark:focus:border-teal-500 focus:ring-teal-500 pr-10"
                  />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-slate-500 hover:text-teal-600" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </Button>
                </motion.div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="confirmPassword" className="text-slate-700 dark:text-slate-300 font-semibold">Confirmar Contraseña</Label>
                <motion.div variants={inputVariants} whileFocus="focus" whileTap="focus" className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Repite tu contraseña"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="bg-white/80 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 focus:border-teal-500 dark:focus:border-teal-500 focus:ring-teal-500 pr-10"
                  />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 text-slate-500 hover:text-teal-600" onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </Button>
                </motion.div>
              </div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="pt-2">
                <Button type="submit" className="w-full bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 text-white font-semibold py-3 text-lg shadow-lg hover:shadow-xl transition-all duration-300" disabled={isLoading}>
                  {isLoading ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"></motion.div>
                  ) : (
                    'Registrarme'
                  )}
                </Button>
              </motion.div>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col items-center space-y-3 pt-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              ¿Ya tienes una cuenta?{' '}
              <Link to="/login" className="font-medium text-teal-600 hover:text-teal-700 dark:text-teal-400 dark:hover:text-teal-300 transition-colors">
                Inicia Sesión Aquí
              </Link>
            </p>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
};

export default SignUpPage;