import { useSyncExternalStore } from 'react';
export type Language = 'ko' | 'en';
export type Theme = 'light' | 'dark';
function read(key:string){try{return localStorage.getItem(key);}catch{return null;}}
let language:Language=read('dojang-language')==='en'?'en':'ko';
let theme:Theme=read('dojang-theme')==='dark'?'dark':read('dojang-theme')==='light'?'light':typeof matchMedia!=='undefined'&&matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
const listeners=new Set<()=>void>();
function apply(){if(typeof document==='undefined')return;document.documentElement.lang=language;document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;document.title='Dojang Scan';}
apply();
function subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener);};}
export function getLanguage(){return language;}
export function getLocale(){return language==='ko'?'ko-KR':'en-US';}
export function setLanguage(value:Language){language=value;try{localStorage.setItem('dojang-language',value);}catch{}apply();listeners.forEach(l=>l());}
export function setTheme(value:Theme){theme=value;try{localStorage.setItem('dojang-theme',value);}catch{}apply();listeners.forEach(l=>l());}
export function usePreferences(){return useSyncExternalStore(subscribe,()=>`${language}:${theme}`,()=> 'ko:light').split(':') as [Language,Theme];}
