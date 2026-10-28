import assert from 'node:assert/strict';
import {cubicValue,cubicSlope,cubicTangent,quarticTangent} from '../web/math-geometry.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
let cases=0;
for (const h of [0,2,-3]) for (const b of [-3,0,3]) for (const t of [-1.2,-1,-.7,0,.7,1,1.2]) {
  const g=cubicTangent(t,b,h);
  near(g.tangent(g.p),cubicValue(g.p,b,h));near(g.tangent(g.q),cubicValue(g.q,b,h));
  near(g.slope,cubicSlope(g.p,b,h));near(2*g.p+g.q,3*h);
  near(g.intercept,g.tangent(0));
  for (const x of [h-2,h-.5,h,h+.8,h+2]) {
    near(cubicValue(x,b,h)-g.tangent(x),(x-g.p)**2*(x-g.q));
    near(cubicValue(h+(x-h),b,h)+cubicValue(h-(x-h),b,h),0);
  }
  assert.equal(g.distinct,t!==0);if(t!==0) near(Math.abs(g.q-h)/Math.abs(g.p-h),2);
  cases++;
}
for (const beta of [2,4,6,-4]) {
  const g=quarticTangent(beta);
  near(g.value(g.alpha),0);near(g.value(g.beta),0);near(g.slope(g.alpha),0);near(g.slope(g.t),0);
  near(g.second(g.alpha),0);near(g.second(g.m),0);
  near(Math.abs((g.t-g.alpha)/(g.beta-g.t)),3);
  const delta=Math.abs(beta)/100;assert.ok(g.second(g.alpha-delta)*g.second(g.alpha+delta)<0);
  assert.ok(g.second(g.m-delta)*g.second(g.m+delta)<0);cases++;
}
console.log(JSON.stringify({geometryCases:cases,errors:[]}));
