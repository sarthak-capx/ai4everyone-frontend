import React from 'react';
import { ExternalLink } from 'lucide-react';

type Props = {
    title?: string;
    subtitle?: string;
    onClick?: () => void;
    className?: string;
};

const ViewDocumentationCard: React.FC<Props> = ({
    title = 'View Documentation',
    subtitle = 'Learn more about how generations and logging work.',
    onClick,
    className = '',
}) => {
    return (
        <div
            className={`group flex justify-between items-center bg-black rounded-[12px] p-6 w-[90%] max-w-[1200px] my-5 mx-auto transition-colors duration-200 cursor-pointer border border-[#888] hover:bg-[#2a2a2a] ${className}`}
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onClick?.();
                }
            }}
        >
            <img src="/images/Icon.png" alt="Document Icon" className="w-10 h-10 mr-6 object-contain block" />
            <div className="flex flex-col">
                <h3 className="text-white font-black text-[20px] md:text-[32px]">{title}</h3>
                <p className="text-[14px] text-[#999]">{subtitle}</p>
            </div>
            <ExternalLink size={24} className="text-[#888] transition-colors duration-200 transform group-hover:text-white group-hover:translate-x-1" />
        </div>
    );
};

export default ViewDocumentationCard; 