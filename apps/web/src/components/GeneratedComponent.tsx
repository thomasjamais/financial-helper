import React from 'react'

interface GeneratedComponentProps {
  title: string
}

export const GeneratedComponent: React.FC<GeneratedComponentProps> = ({ title }) => {
  return (
    <div className="generated-component">
      <h1>{title}</h1>
      <p>This component was generated from the issue specification.</p>
    </div>
  )
}