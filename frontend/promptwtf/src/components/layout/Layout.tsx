import React from 'react';
import Head from 'next/head';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

export const Layout: React.FC<LayoutProps> = ({ 
  children, 
  title = 'promptwtf - Reverse Prompt Engineering' 
}) => {
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <div className="min-h-screen bg-background text-textPrimary">
        <main className="container mx-auto px-4 py-8">
          {children}
        </main>
      </div>
    </>
  );
}; 