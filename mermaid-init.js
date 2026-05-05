// Likewise mermaid initializer.
//
// The site is dark-only (theme switcher hidden in likewise.css), so we
// always render with mermaid's `base` theme tinted to the Likewise palette.

(() => {
    mermaid.initialize({
        startOnLoad: true,
        theme: 'base',
        themeVariables: {
            darkMode: true,
            background: 'transparent',
            primaryColor: '#1a164d',
            primaryTextColor: '#f4f3ff',
            primaryBorderColor: '#a78bfa',
            secondaryColor: '#0f1230',
            secondaryTextColor: '#f4f3ff',
            secondaryBorderColor: 'rgba(244,243,255,0.18)',
            tertiaryColor: '#0f1230',
            tertiaryTextColor: '#f4f3ff',
            tertiaryBorderColor: 'rgba(244,243,255,0.18)',
            lineColor: '#a78bfa',
            textColor: '#f4f3ff',
            mainBkg: '#1a164d',
            nodeBorder: '#a78bfa',
            clusterBkg: 'rgba(167,139,250,0.06)',
            clusterBorder: 'rgba(244,243,255,0.18)',
            // sequenceDiagram
            actorBkg: '#1a164d',
            actorBorder: '#a78bfa',
            actorTextColor: '#f4f3ff',
            actorLineColor: 'rgba(244,243,255,0.45)',
            signalColor: '#f4f3ff',
            signalTextColor: '#f4f3ff',
            labelBoxBkgColor: '#1a164d',
            labelBoxBorderColor: '#a78bfa',
            labelTextColor: '#f4f3ff',
            loopTextColor: '#f4f3ff',
            noteBkgColor: 'rgba(167,139,250,0.12)',
            noteBorderColor: '#a78bfa',
            noteTextColor: '#f4f3ff',
            activationBkgColor: '#7c5cff',
            activationBorderColor: '#a78bfa',
            // stateDiagram
            transitionColor: '#f4f3ff',
            transitionLabelColor: '#f4f3ff',
            stateLabelColor: '#f4f3ff',
            stateBkg: '#1a164d',
            altBackground: 'rgba(244,243,255,0.04)',
            compositeBackground: 'rgba(244,243,255,0.04)',
            compositeTitleBackground: 'rgba(167,139,250,0.12)',
            compositeBorder: 'rgba(244,243,255,0.18)',
            innerEndBackground: '#1a164d',
            specialStateColor: '#a78bfa',
        },
    });
})();
