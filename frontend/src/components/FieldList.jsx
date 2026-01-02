import React from 'react';

function FieldList({ fields, selectedField, onSelectField, fieldMappings, currentPage }) {
  const getFieldStatus = (fieldName) => {
    if (fieldMappings[fieldName]) {
      const [, , , , pageNum] = fieldMappings[fieldName];
      if (pageNum === currentPage) {
        return 'mapped-current';
      }
      return 'mapped-other';
    }
    return 'unmapped';
  };

  return (
    <div className="field-list">
      <h3>Fields</h3>
      <p className="field-list-hint">Select a field, then draw on the PDF</p>
      <div className="field-items">
        {fields.map((field) => {
          const status = getFieldStatus(field);
          const isSelected = selectedField === field;
          const mapping = fieldMappings[field];

          return (
            <div
              key={field}
              className={`field-item ${status} ${isSelected ? 'selected' : ''}`}
              onClick={() => onSelectField(field)}
            >
              <div className="field-name">{field}</div>
              {mapping && (
                <div className="field-mapping-info">
                  Page {mapping[4]} • {mapping[0]}, {mapping[1]} → {mapping[2]}, {mapping[3]}
                </div>
              )}
              {status === 'mapped-current' && (
                <span className="field-badge">✓</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="field-legend">
        <div className="legend-item">
          <span className="legend-color unmapped"></span>
          <span>Not mapped</span>
        </div>
        <div className="legend-item">
          <span className="legend-color mapped-other"></span>
          <span>Mapped (other page)</span>
        </div>
        <div className="legend-item">
          <span className="legend-color mapped-current"></span>
          <span>Mapped (this page)</span>
        </div>
      </div>
    </div>
  );
}

export default FieldList;

