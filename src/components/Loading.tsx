import React from 'react'

const Loading: React.FC<{ fullScreen?: boolean; message?: string }> = ({ 
  fullScreen = false, 
  message = 'Loading...' 
}) => {
  if (fullScreen) {
    return (
      <div className="loading-fullscreen">
        <div className="loading-spinner-wrapper">
          <div className="loading-spinner"></div>
          <p className="loading-message">{message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="loading-inline">
      <div className="loading-spinner"></div>
      <p className="loading-message">{message}</p>
    </div>
  )
}

export default Loading
