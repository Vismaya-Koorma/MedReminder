import React, { useState } from 'react';
import { BarChart3, TrendingUp, Calendar, Info, CheckCircle2 } from 'lucide-react';

const WeeklyAdherenceChart = ({ data, loading }) => {
  const [hoveredDay, setHoveredDay] = useState(null);

  if (loading) {
    return (
      <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#64748b' }}>
        <p style={{ fontWeight: 600 }}>Loading Weekly Medication Adherence...</p>
      </div>
    );
  }

  const days = data?.days || [];
  const weekLabel = data?.week_label || 'Current Week';
  const weeklyAverage = data?.weekly_adherence_percentage;

  // Reference guidelines (percentages)
  const gridLines = [100, 75, 50, 25, 0];

  return (
    <div className="card" style={{ marginBottom: '1.5rem', overflow: 'hidden' }}>
      {/* Card Header */}
      <div className="card-header" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '0.65rem',
              backgroundColor: '#ccfbf1',
              color: '#0d9488',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <BarChart3 size={22} />
          </div>
          <div>
            <h2 className="card-title" style={{ margin: 0, fontSize: '1.15rem' }}>
              Weekly Medication Adherence
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginTop: '0.2rem', color: '#64748b', fontSize: '0.8rem' }}>
              <Calendar size={13} />
              <span>{weekLabel}</span>
            </div>
          </div>
        </div>

        {/* Header Right: Summary Badge & Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', fontSize: '0.75rem', color: '#64748b' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: '#0d9488', display: 'inline-block' }}></span>
              Adherence %
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: 10, height: 10, borderRadius: 2, border: '1px dashed #94a3b8', display: 'inline-block' }}></span>
              No Doses (—)
            </span>
          </div>

          {weeklyAverage !== null && weeklyAverage !== undefined && (
            <div
              style={{
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                color: '#166534',
                padding: '0.35rem 0.75rem',
                borderRadius: '0.5rem',
                fontSize: '0.825rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}
            >
              <TrendingUp size={15} />
              <span>Week Avg: {weeklyAverage}%</span>
            </div>
          )}
        </div>
      </div>

      {/* Chart Canvas Area */}
      <div style={{ position: 'relative', paddingTop: '1rem' }}>
        {/* Y-Axis Grid Lines & Labels */}
        <div
          style={{
            position: 'absolute',
            top: '1rem',
            left: 0,
            right: 0,
            bottom: '70px',
            pointerEvents: 'none',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between'
          }}
        >
          {gridLines.map((val) => (
            <div
              key={val}
              style={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                gap: '0.5rem'
              }}
            >
              <span
                style={{
                  width: '32px',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  color: '#94a3b8',
                  textAlign: 'right',
                  flexShrink: 0
                }}
              >
                {val}%
              </span>
              <div
                style={{
                  flex: 1,
                  borderBottom: val === 0 ? '1px solid #cbd5e1' : '1px dashed #e2e8f0'
                }}
              />
            </div>
          ))}
        </div>

        {/* Bars Container */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            marginLeft: '40px',
            paddingRight: '0.5rem',
            gap: '0.75rem',
            minHeight: '200px',
            position: 'relative',
            zIndex: 1
          }}
        >
          {days.map((item) => {
            const hasScheduled = item.scheduled_count > 0;
            const percentage = item.adherence_percentage;
            const isHovered = hoveredDay?.date === item.date;

            // Bar fill height (percentage: 0 to 100)
            const fillHeight = hasScheduled ? Math.max(percentage, 0) : 0;

            // Bar color logic: Healthcare teal gradient, vibrant emerald for 100%
            let barColor = 'linear-gradient(180deg, #0d9488 0%, #14b8a6 100%)';
            if (percentage === 100) {
              barColor = 'linear-gradient(180deg, #059669 0%, #10b981 100%)';
            } else if (percentage === 0 && hasScheduled) {
              barColor = '#f43f5e'; // Highlight 0% when doses were missed
            }

            return (
              <div
                key={item.date}
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  minWidth: 0,
                  cursor: 'pointer',
                  position: 'relative'
                }}
                onMouseEnter={() => setHoveredDay(item)}
                onMouseLeave={() => setHoveredDay(null)}
                onClick={() => setHoveredDay(hoveredDay?.date === item.date ? null : item)}
              >
                {/* Value Label Above Bar */}
                <div
                  style={{
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: isHovered ? '#0d9488' : hasScheduled ? '#334155' : '#94a3b8',
                    marginBottom: '0.35rem',
                    transition: 'color 0.2s ease',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {hasScheduled ? `${percentage}%` : '—'}
                </div>

                {/* Vertical Bar Column */}
                <div
                  style={{
                    width: '100%',
                    maxWidth: '46px',
                    height: '140px',
                    backgroundColor: hasScheduled ? '#f1f5f9' : '#f8fafc',
                    border: hasScheduled ? 'none' : '1px dashed #cbd5e1',
                    borderRadius: '8px 8px 0 0',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    alignItems: 'center',
                    position: 'relative',
                    boxShadow: isHovered ? '0 0 0 2px #0d9488' : 'none',
                    transition: 'box-shadow 0.2s ease, transform 0.2s ease',
                    transform: isHovered ? 'translateY(-2px)' : 'none'
                  }}
                >
                  {hasScheduled ? (
                    percentage > 0 ? (
                      <div
                        style={{
                          width: '100%',
                          height: `${fillHeight}%`,
                          minHeight: '6px',
                          background: barColor,
                          borderRadius: '6px 6px 0 0',
                          transition: 'height 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                      />
                    ) : (
                      // 0% adherence line indicator
                      <div
                        style={{
                          width: '100%',
                          height: '4px',
                          backgroundColor: '#f43f5e',
                          borderRadius: '2px 2px 0 0'
                        }}
                      />
                    )
                  ) : (
                    // Empty scheduled day placeholder
                    <div
                      style={{
                        position: 'absolute',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: '#94a3b8',
                        fontSize: '0.9rem',
                        fontWeight: 600
                      }}
                    >
                      —
                    </div>
                  )}
                </div>

                {/* X-Axis Day & Date Label */}
                <div
                  style={{
                    marginTop: '0.65rem',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.15rem'
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.8rem',
                      fontWeight: item.is_today ? 700 : 600,
                      color: item.is_today ? '#0d9488' : '#334155'
                    }}
                  >
                    {item.day}
                  </span>
                  <span
                    style={{
                      fontSize: '0.7rem',
                      color: item.is_today ? '#0d9488' : '#94a3b8',
                      fontWeight: item.is_today ? 700 : 500
                    }}
                  >
                    {new Date(item.date).getDate()}
                  </span>
                  {item.is_today && (
                    <span
                      style={{
                        fontSize: '0.65rem',
                        backgroundColor: '#ccfbf1',
                        color: '#0d9488',
                        fontWeight: 700,
                        padding: '0.1rem 0.35rem',
                        borderRadius: '0.25rem',
                        marginTop: '0.15rem',
                        lineHeight: 1.2
                      }}
                    >
                      Today
                    </span>
                  )}
                </div>

                {/* Hover Tooltip */}
                {isHovered && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 'calc(100% + 5px)',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      backgroundColor: '#0f172a',
                      color: '#ffffff',
                      padding: '0.65rem 0.85rem',
                      borderRadius: '0.5rem',
                      boxShadow: '0 10px 20px -3px rgba(0, 0, 0, 0.3)',
                      zIndex: 100,
                      minWidth: '150px',
                      pointerEvents: 'none',
                      whiteSpace: 'nowrap',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f8fafc', borderBottom: '1px solid #334155', paddingBottom: '0.3rem', marginBottom: '0.35rem' }}>
                      {item.day_name}, {new Date(item.date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </div>

                    {hasScheduled ? (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', fontSize: '0.8rem', marginBottom: '0.2rem' }}>
                          <span style={{ color: '#94a3b8' }}>Adherence:</span>
                          <span style={{ fontWeight: 700, color: percentage >= 80 ? '#34d399' : percentage > 0 ? '#38bdf8' : '#fb7185' }}>
                            {percentage}%
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', fontSize: '0.75rem', color: '#cbd5e1' }}>
                          <span>Doses Taken:</span>
                          <span style={{ fontWeight: 600 }}>{item.taken_count} / {item.scheduled_count}</span>
                        </div>
                        {item.missed_count > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', fontSize: '0.75rem', color: '#fca5a5' }}>
                            <span>Missed:</span>
                            <span style={{ fontWeight: 600 }}>{item.missed_count}</span>
                          </div>
                        )}
                        {item.upcoming_count > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', fontSize: '0.75rem', color: '#93c5fd' }}>
                            <span>Upcoming:</span>
                            <span style={{ fontWeight: 600 }}>{item.upcoming_count}</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        No doses scheduled (—)
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Chart Footer / Info Note */}
      <div
        style={{
          marginTop: '1.25rem',
          paddingTop: '0.85rem',
          borderTop: '1px solid #f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.75rem',
          fontSize: '0.775rem',
          color: '#64748b'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Info size={14} color="#0d9488" />
          <span>
            Daily adherence = (Doses Taken / Total Scheduled Doses) × 100. Days with no scheduled doses show "—".
          </span>
        </div>
        {data?.total_week_scheduled > 0 && (
          <span style={{ fontWeight: 600, color: '#0f172a' }}>
            Week Total: {data.total_week_taken} taken of {data.total_week_scheduled} scheduled
          </span>
        )}
      </div>
    </div>
  );
};

export default WeeklyAdherenceChart;
