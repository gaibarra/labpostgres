import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { motion } from 'framer-motion';
import { MailQuestion, ArrowLeft } from 'lucide-react';

const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { resetPasswordForEmail } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await resetPasswordForEmail(email);
    setIsLoading(false);
    if (!error) {
      toast({
        title: "Correo Enviado",
        description: "Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña.",
        variant: "success",
        duration: 7000,
      });
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
    <div className="min-h-screen bg-gradient-to-br from-amber-400 via-orange-500 to-red-600 flex items-center justify-center p-4">
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
      >
        <Card className="w-full max-w-md shadow-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-lg">
          <CardHeader className="text-center">
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring", stiffness: 120 }}>
              <MailQuestion className="mx-auto h-16 w-16 text-orange-600 mb-4" />
            </motion.div>
            <CardTitle className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-orange-500 to-red-500">
              ¿Olvidaste tu Contraseña?
            </CardTitle>
            <CardDescription className="text-slate-600 dark:text-slate-400">
              No te preocupes. Ingresa tu correo y te enviaremos un enlace para restablecerla.
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
                    className="bg-white/80 dark:bg-slate-800/80 border-slate-300 dark:border-slate-700 focus:border-orange-500 dark:focus:border-orange-500 focus:ring-orange-500"
                  />
                </motion.div>
              </div>
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Button type="submit" className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white font-semibold py-3 text-lg shadow-lg hover:shadow-xl transition-all duration-300" disabled={isLoading}>
                  {isLoading ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="w-5 h-5 border-2 border-white border-t-transparent rounded-full mr-2"></motion.div>
                  ) : (
                    'Enviar Enlace de Restablecimiento'
                  )}
                </Button>
              </motion.div>
            </form>
          </CardContent>
          <CardFooter className="flex flex-col items-center space-y-3 pt-6">
            <Link to="/login" className="text-sm text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 transition-colors flex items-center">
              <ArrowLeft size={16} className="mr-1" />
              Volver a Iniciar Sesión
            </Link>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
};

export default ForgotPasswordPage;