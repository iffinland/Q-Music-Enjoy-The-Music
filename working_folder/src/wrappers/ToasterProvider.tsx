"use client";

import { Toaster } from "react-hot-toast";

const ToasterProvider = () => {
  return ( 
    <Toaster 
      toastOptions={{
        duration: 2000,
        style: {
          background: '#1f2937',
          color: '#e5e7eb',
        },
        success: {
          style: {
            background: '#065f46',
            color: '#e7f8ef',
          },
        },
        error: {
          style: {
            background: '#7f1d1d',
            color: '#fee2e2',
          },
        }
      }}
    /> 
  );
}
 
export default ToasterProvider;
