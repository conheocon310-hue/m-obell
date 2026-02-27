
import React from 'react';

interface BlockProps {
    colorClass: string; // e.g., 'border-pink-500' or 'neon-cyan'
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
}

export const Block: React.FC<BlockProps> = ({ colorClass, children, className = '', onClick }) => {
    
    return (
        <div 
            onClick={onClick}
            className={`
                relative rounded-3xl backdrop-blur-3xl bg-black/40 border-[1.5px]
                ${colorClass}
                ${onClick ? 'cursor-pointer hover:bg-white/5 transition-all duration-300 active:scale-[0.98]' : ''}
                ${className}
            `}
        >
            {children}
        </div>
    );
};
