import React from 'react'
import logoImage from '../assets/logo.png'

interface LogoProps {
  className?: string
  size?: 'small' | 'medium' | 'large' | 'smaller'
  showText?: boolean
}

const Logo: React.FC<LogoProps> = ({ className = '', size = 'smaller', showText = false }) => {
  const sizeClasses = {
    smaller: 'w-8 h-8',
    small: 'w-10 h-10',
    medium: 'w-12 h-12',
    large: 'w-16 h-16'
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className={`${sizeClasses[size]} flex-shrink-0`}>
        <img src={logoImage} alt="SKYZ Metro FM Logo" className="w-full h-full object-contain" />
      </div>
      {showText && (
        <div className="flex flex-col text-lg">
          <span className="font-bold text-orange-500 leading-tight">SKYZ</span>
          <span className="font-semibold text-blue-600 text-xs leading-tight">METRO FM</span>
        </div>
      )}
    </div>
  )
}

export default Logo