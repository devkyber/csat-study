// Coordinates are computed from the displayed polynomial, never from a drawing.
export function cubicValue(x,b=-3,h=0) {const u=x-h;return u*u*u+b*u;}
export function cubicSlope(x,b=-3,h=0) {const u=x-h;return 3*u*u+b;}
export function cubicTangent(t,b=-3,h=0) {
  const p=h+t,q=h-2*t,slope=cubicSlope(p,b,h);
  return {h,p,q,slope,yP:cubicValue(p,b,h),yQ:cubicValue(q,b,h),intercept:-slope*h-2*t*t*t,
    tangent:x=>slope*(x-h)-2*t*t*t,
    distinct:Math.abs(t)>1e-9,near:Math.abs(t),far:2*Math.abs(t)};
}
export function quarticTangent(beta=4) {
  return {alpha:0,m:beta/2,t:3*beta/4,beta,
    value:x=>x*x*x*(x-beta),slope:x=>x*x*(4*x-3*beta),
    second:x=>6*x*(2*x-beta)};
}
