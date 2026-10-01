(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.SanadThemeCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const MODES=Object.freeze(['light','dark','system']);

  function isValidMode(mode){
    return MODES.includes(mode);
  }

  function normalizeMode(mode,fallback='light'){
    return isValidMode(mode)?mode:(isValidMode(fallback)?fallback:'light');
  }

  function resolveMode(mode,prefersDark){
    const normalized=normalizeMode(mode);
    if(normalized!=='system')return normalized;
    return prefersDark?'dark':'light';
  }

  function metaThemeColor(resolvedMode){
    return resolvedMode==='dark'?'#0B1110':'#F6F9F8';
  }

  return Object.freeze({
    MODES,
    isValidMode,
    normalizeMode,
    resolveMode,
    metaThemeColor
  });
});
