// =====================================================
// INTERFACE
// =====================================================

const inputTexto =
    document.getElementById("texto");

const selectFonte =
    document.getElementById("fonte");

const inputTamanho =
    document.getElementById("tamanho");

const inputBorda =
    document.getElementById("borda");

const inputFuro =
    document.getElementById("furo");

const inputEspessuraArgola =
    document.getElementById("espessuraArgola");

const inputPosicaoArgola =
    document.getElementById("posicaoArgola");

const valorPosicaoArgola =
    document.getElementById("valorPosicaoArgola");

const inputAlturaFinal =
    document.getElementById("alturaFinal");

const inputIncluirPreenchimento =
    document.getElementById("incluirPreenchimento");

const dimensoesFinais =
    document.getElementById("dimensoesFinais");

const botaoGerar =
    document.getElementById("gerar");

const botaoBaixar =
    document.getElementById("baixar");

const botaoBaixarDuplaCamada =
    document.getElementById(
        "baixarDuplaCamada"
    );

const mensagem =
    document.getElementById("mensagem");


// =====================================================
// ELEMENTOS DA PRANCHETA
// =====================================================

const mesaMedicao =
    document.getElementById("mesaMedicao");

const reguaHorizontal =
    document.getElementById(
        "reguaHorizontal"
    );

const reguaVertical =
    document.getElementById(
        "reguaVertical"
    );

const areaMedicao =
    document.getElementById(
        "areaMedicao"
    );

const pecaPreview =
    document.getElementById(
        "pecaPreview"
    );

const medidasPreview =
    document.getElementById(
        "medidasPreview"
    );


// =====================================================
// CONFIGURAÇÃO DA PRANCHETA
// =====================================================

const PX_POR_MM =
    5;

const LARGURA_REGUA_VERTICAL =
    38;

const ALTURA_REGUA_HORIZONTAL =
    30;

const MARGEM_PRANCHETA_MM =
    10;


// =====================================================
// ESTADO
// =====================================================

let svgGerado =
    "";

let svgGeradoDuplaCamada =
    "";

const cacheFontes =
    new Map();

const fontesEmCarregamento =
    new Map();

const ESCALA_CLIPPER =
    1000;

let geracaoAtual =
    0;


// =====================================================
// CARREGAMENTO DA FONTE
// =====================================================

function carregarFonte(caminho) {

    if (
        cacheFontes.has(caminho)
    ) {

        return Promise.resolve(
            cacheFontes.get(caminho)
        );
    }


    if (
        fontesEmCarregamento.has(caminho)
    ) {

        return fontesEmCarregamento.get(
            caminho
        );
    }


    mensagem.textContent =
        "Carregando fonte...";


    const promessa =
        new Promise(
            (resolve, reject) => {

                opentype.load(
                    caminho,

                    function (erro, fonte) {

                        fontesEmCarregamento.delete(
                            caminho
                        );


                        if (erro) {

                            reject(
                                new Error(
                                    "Erro ao carregar fonte: " +
                                    erro
                                )
                            );

                            return;
                        }


                        cacheFontes.set(
                            caminho,
                            fonte
                        );


                        resolve(
                            fonte
                        );
                    }
                );
            }
        );


    fontesEmCarregamento.set(
        caminho,
        promessa
    );


    return promessa;
}


// =====================================================
// CURVAS
// =====================================================

function pontoQuadratico(
    p0,
    p1,
    p2,
    t
) {

    const mt =
        1 - t;


    return {

        x:
            mt * mt * p0.x +
            2 * mt * t * p1.x +
            t * t * p2.x,

        y:
            mt * mt * p0.y +
            2 * mt * t * p1.y +
            t * t * p2.y
    };
}


function pontoCubico(
    p0,
    p1,
    p2,
    p3,
    t
) {

    const mt =
        1 - t;


    return {

        x:
            mt * mt * mt * p0.x +
            3 * mt * mt * t * p1.x +
            3 * mt * t * t * p2.x +
            t * t * t * p3.x,

        y:
            mt * mt * mt * p0.y +
            3 * mt * mt * t * p1.y +
            3 * mt * t * t * p2.y +
            t * t * t * p3.y
    };
}


// =====================================================
// OPENTYPE → POLÍGONOS
// =====================================================

function pathParaPoligonos(path) {

    const poligonos =
        [];

    let atual =
        [];

    let pontoAtual =
        null;

    const segmentosCurva =
        12;


    function finalizar() {

        if (
            atual.length >= 3
        ) {

            poligonos.push(
                atual
            );
        }


        atual =
            [];

        pontoAtual =
            null;
    }


    for (
        const cmd of path.commands
    ) {

        if (
            cmd.type === "M"
        ) {

            if (
                atual.length >= 3
            ) {

                finalizar();
            }


            pontoAtual = {

                x:
                    cmd.x,

                y:
                    cmd.y
            };


            atual.push({

                ...pontoAtual
            });
        }


        else if (
            cmd.type === "L"
        ) {

            pontoAtual = {

                x:
                    cmd.x,

                y:
                    cmd.y
            };


            atual.push({

                ...pontoAtual
            });
        }


        else if (
            cmd.type === "Q"
        ) {

            const inicio = {

                ...pontoAtual
            };


            const controle = {

                x:
                    cmd.x1,

                y:
                    cmd.y1
            };


            const fim = {

                x:
                    cmd.x,

                y:
                    cmd.y
            };


            for (
                let i = 1;
                i <= segmentosCurva;
                i++
            ) {

                const t =
                    i /
                    segmentosCurva;


                atual.push(

                    pontoQuadratico(
                        inicio,
                        controle,
                        fim,
                        t
                    )
                );
            }


            pontoAtual =
                fim;
        }


        else if (
            cmd.type === "C"
        ) {

            const inicio = {

                ...pontoAtual
            };


            const controle1 = {

                x:
                    cmd.x1,

                y:
                    cmd.y1
            };


            const controle2 = {

                x:
                    cmd.x2,

                y:
                    cmd.y2
            };


            const fim = {

                x:
                    cmd.x,

                y:
                    cmd.y
            };


            for (
                let i = 1;
                i <= segmentosCurva;
                i++
            ) {

                const t =
                    i /
                    segmentosCurva;


                atual.push(

                    pontoCubico(
                        inicio,
                        controle1,
                        controle2,
                        fim,
                        t
                    )
                );
            }


            pontoAtual =
                fim;
        }


        else if (
            cmd.type === "Z"
        ) {

            if (
                atual.length >= 3
            ) {

                finalizar();
            }
        }
    }


    if (
        atual.length >= 3
    ) {

        finalizar();
    }


    return poligonos;
}


// =====================================================
// CLIPPER
// =====================================================

function converterParaClipper(
    poligonos
) {

    return poligonos.map(

        poligono =>

            poligono.map(

                ponto => ({

                    X:
                        Math.round(
                            ponto.x *
                            ESCALA_CLIPPER
                        ),

                    Y:
                        Math.round(
                            ponto.y *
                            ESCALA_CLIPPER
                        )
                })
            )
    );
}


function unirPaths(paths) {

    const clipper =
        new ClipperLib.Clipper();


    clipper.AddPaths(
        paths,
        ClipperLib.PolyType.ptSubject,
        true
    );


    const resultado =
        [];


    clipper.Execute(
        ClipperLib.ClipType.ctUnion,
        resultado,
        ClipperLib.PolyFillType.pftNonZero,
        ClipperLib.PolyFillType.pftNonZero
    );


    return resultado;
}


function gerarContorno(
    poligonos,
    distancia
) {

    const paths =
        converterParaClipper(
            poligonos
        );


    const unidos =
        unirPaths(
            paths
        );


    const offset =
        new ClipperLib.ClipperOffset(
            2,
            0.25 *
            ESCALA_CLIPPER
        );


    offset.AddPaths(
        unidos,
        ClipperLib.JoinType.jtRound,
        ClipperLib.EndType.etClosedPolygon
    );


    const resultado =
        [];


    offset.Execute(
        resultado,
        distancia *
        ESCALA_CLIPPER
    );


    return unirPaths(
        resultado
    );
}


// =====================================================
// CONTORNOS EXTERNOS
// =====================================================

function estaDentro(
    poligono,
    outro
) {

    if (
        !poligono.length ||
        !outro.length
    ) {

        return false;
    }


    return (
        ClipperLib.Clipper.PointInPolygon(
            poligono[0],
            outro
        ) !== 0
    );
}


function apenasContornosExternos(
    paths
) {

    return paths.filter(

        (path, indice) => {

            for (
                let i = 0;
                i < paths.length;
                i++
            ) {

                if (
                    i === indice
                ) {

                    continue;
                }


                if (
                    estaDentro(
                        path,
                        paths[i]
                    )
                ) {

                    return false;
                }
            }


            return true;
        }
    );
}


// =====================================================
// CÍRCULO
// =====================================================

function criarCirculo(
    cx,
    cy,
    raio,
    segmentos = 72
) {

    const path =
        [];


    for (
        let i = 0;
        i < segmentos;
        i++
    ) {

        const angulo =
            2 *
            Math.PI *
            i /
            segmentos;


        path.push({

            X:
                Math.round(
                    (
                        cx +
                        raio *
                        Math.cos(
                            angulo
                        )
                    ) *
                    ESCALA_CLIPPER
                ),

            Y:
                Math.round(
                    (
                        cy +
                        raio *
                        Math.sin(
                            angulo
                        )
                    ) *
                    ESCALA_CLIPPER
                )
        });
    }


    return path;
}


// =====================================================
// ÁREA
// =====================================================

function areaPath(path) {

    let area =
        0;


    for (
        let i = 0;
        i < path.length;
        i++
    ) {

        const p1 =
            path[i];


        const p2 =
            path[
                (i + 1) %
                path.length
            ];


        area +=
            p1.X *
            p2.Y -
            p2.X *
            p1.Y;
    }


    return area /
        2;
}


// =====================================================
// CONTORNO PRINCIPAL
// =====================================================

function selecionarContornoPrincipal(
    paths
) {

    if (
        !paths.length
    ) {

        return null;
    }


    let principal =
        paths[0];


    let maiorArea =
        Math.abs(
            areaPath(
                principal
            )
        );


    for (
        let i = 1;
        i < paths.length;
        i++
    ) {

        const area =
            Math.abs(
                areaPath(
                    paths[i]
                )
            );


        if (
            area > maiorArea
        ) {

            maiorArea =
                area;

            principal =
                paths[i];
        }
    }


    return principal;
}


// =====================================================
// INÍCIO DO SLIDER À ESQUERDA
// =====================================================

function iniciarPathPelaEsquerda(
    path
) {

    let minX =
        Infinity;

    let minY =
        Infinity;

    let maxY =
        -Infinity;


    for (
        const p of path
    ) {

        minX =
            Math.min(
                minX,
                p.X
            );


        minY =
            Math.min(
                minY,
                p.Y
            );


        maxY =
            Math.max(
                maxY,
                p.Y
            );
    }


    const centroY =
        (
            minY +
            maxY
        ) /
        2;


    const tolerancia =
        1.5 *
        ESCALA_CLIPPER;


    let indice =
        0;

    let melhorDistancia =
        Infinity;


    for (
        let i = 0;
        i < path.length;
        i++
    ) {

        const p =
            path[i];


        if (
            p.X <=
            minX +
            tolerancia
        ) {

            const distancia =
                Math.abs(
                    p.Y -
                    centroY
                );


            if (
                distancia <
                melhorDistancia
            ) {

                melhorDistancia =
                    distancia;

                indice =
                    i;
            }
        }
    }


    return [

        ...path.slice(
            indice
        ),

        ...path.slice(
            0,
            indice
        )
    ];
}


// =====================================================
// PERÍMETRO
// =====================================================

function construirPerimetro(
    path
) {

    const segmentos =
        [];

    let comprimentoTotal =
        0;


    for (
        let i = 0;
        i < path.length;
        i++
    ) {

        const p1 =
            path[i];


        const p2 =
            path[
                (i + 1) %
                path.length
            ];


        const dx =
            p2.X -
            p1.X;


        const dy =
            p2.Y -
            p1.Y;


        const comprimento =
            Math.hypot(
                dx,
                dy
            );


        if (
            comprimento === 0
        ) {

            continue;
        }


        segmentos.push({

            p1,

            p2,

            inicio:
                comprimentoTotal,

            comprimento
        });


        comprimentoTotal +=
            comprimento;
    }


    return {

        segmentos,

        comprimentoTotal
    };
}


function pontoNaDistancia(
    segmentos,
    comprimentoTotal,
    distancia
) {

    let d =
        distancia %
        comprimentoTotal;


    if (
        d < 0
    ) {

        d +=
            comprimentoTotal;
    }


    for (
        const segmento of segmentos
    ) {

        const fim =
            segmento.inicio +
            segmento.comprimento;


        if (
            d <= fim
        ) {

            const distanciaLocal =
                d -
                segmento.inicio;


            const t =
                distanciaLocal /
                segmento.comprimento;


            return {

                X:
                    segmento.p1.X +
                    (
                        segmento.p2.X -
                        segmento.p1.X
                    ) *
                    t,

                Y:
                    segmento.p1.Y +
                    (
                        segmento.p2.Y -
                        segmento.p1.Y
                    ) *
                    t
            };
        }
    }


    return {

        X:
            segmentos[0].p1.X,

        Y:
            segmentos[0].p1.Y
    };
}


// =====================================================
// VETORES
// =====================================================

function normalizarVetor(
    x,
    y
) {

    const comprimento =
        Math.hypot(
            x,
            y
        );


    if (
        comprimento === 0
    ) {

        return null;
    }


    return {

        x:
            x /
            comprimento,

        y:
            y /
            comprimento
    };
}


// =====================================================
// POSIÇÃO SUAVIZADA DA ARGOLA
// =====================================================

function pontoNoPerimetro(
    path,
    percentual
) {

    const {

        segmentos,

        comprimentoTotal

    } =
        construirPerimetro(
            path
        );


    let fracao =
        percentual /
        100;


    if (
        fracao >= 1
    ) {

        fracao =
            0;
    }


    const distanciaAtual =
        comprimentoTotal *
        fracao;


    const pontoAtual =
        pontoNaDistancia(
            segmentos,
            comprimentoTotal,
            distanciaAtual
        );


    const janelaBase =
        Math.min(

            10 *
            ESCALA_CLIPPER,

            Math.max(

                3 *
                ESCALA_CLIPPER,

                comprimentoTotal *
                0.012
            )
        );


    function calcularTangente(
        janela
    ) {

        const anterior =
            pontoNaDistancia(
                segmentos,
                comprimentoTotal,
                distanciaAtual -
                janela
            );


        const posterior =
            pontoNaDistancia(
                segmentos,
                comprimentoTotal,
                distanciaAtual +
                janela
            );


        return normalizarVetor(

            posterior.X -
            anterior.X,

            posterior.Y -
            anterior.Y
        );
    }


    const tangenteCurta =
        calcularTangente(
            janelaBase *
            0.35
        );


    const tangenteMedia =
        calcularTangente(
            janelaBase *
            0.70
        );


    const tangenteLonga =
        calcularTangente(
            janelaBase
        );


    const tx =
        tangenteCurta.x *
        0.45 +

        tangenteMedia.x *
        0.35 +

        tangenteLonga.x *
        0.20;


    const ty =
        tangenteCurta.y *
        0.45 +

        tangenteMedia.y *
        0.35 +

        tangenteLonga.y *
        0.20;


    const tangente =
        normalizarVetor(
            tx,
            ty
        );


    const area =
        areaPath(
            path
        );


    let normal;


    if (
        area > 0
    ) {

        normal = {

            x:
                tangente.y,

            y:
                -tangente.x
        };
    }

    else {

        normal = {

            x:
                -tangente.y,

            y:
                tangente.x
        };
    }


    return {

        x:
            pontoAtual.X /
            ESCALA_CLIPPER,

        y:
            pontoAtual.Y /
            ESCALA_CLIPPER,

        tangente,

        normal
    };
}


// =====================================================
// CONECTOR
// =====================================================

function criarConectorOrientado(
    ponto,
    centro,
    tangente,
    largura
) {

    const metade =
        largura /
        2;


    const tx =
        tangente.x *
        metade;


    const ty =
        tangente.y *
        metade;


    return [

        {
            X:
                Math.round(
                    (
                        ponto.x -
                        tx
                    ) *
                    ESCALA_CLIPPER
                ),

            Y:
                Math.round(
                    (
                        ponto.y -
                        ty
                    ) *
                    ESCALA_CLIPPER
                )
        },

        {
            X:
                Math.round(
                    (
                        ponto.x +
                        tx
                    ) *
                    ESCALA_CLIPPER
                ),

            Y:
                Math.round(
                    (
                        ponto.y +
                        ty
                    ) *
                    ESCALA_CLIPPER
                )
        },

        {
            X:
                Math.round(
                    (
                        centro.x +
                        tx
                    ) *
                    ESCALA_CLIPPER
                ),

            Y:
                Math.round(
                    (
                        centro.y +
                        ty
                    ) *
                    ESCALA_CLIPPER
                )
        },

        {
            X:
                Math.round(
                    (
                        centro.x -
                        tx
                    ) *
                    ESCALA_CLIPPER
                ),

            Y:
                Math.round(
                    (
                        centro.y -
                        ty
                    ) *
                    ESCALA_CLIPPER
                )
        }
    ];
}


// =====================================================
// BOUNDING BOX
// =====================================================

function boundingBoxClipper(
    paths
) {

    let minX =
        Infinity;

    let minY =
        Infinity;

    let maxX =
        -Infinity;

    let maxY =
        -Infinity;


    for (
        const path of paths
    ) {

        for (
            const ponto of path
        ) {

            const x =
                ponto.X /
                ESCALA_CLIPPER;


            const y =
                ponto.Y /
                ESCALA_CLIPPER;


            minX =
                Math.min(
                    minX,
                    x
                );


            minY =
                Math.min(
                    minY,
                    y
                );


            maxX =
                Math.max(
                    maxX,
                    x
                );


            maxY =
                Math.max(
                    maxY,
                    y
                );
        }
    }


    return {

        minX,

        minY,

        maxX,

        maxY
    };
}


// =====================================================
// CLIPPER → SVG
// =====================================================

function clipperParaSvg(
    paths
) {

    let d =
        "";


    for (
        const path of paths
    ) {

        if (
            !path.length
        ) {

            continue;
        }


        d +=
            `M ${
                path[0].X /
                ESCALA_CLIPPER
            } ${
                path[0].Y /
                ESCALA_CLIPPER
            } `;


        for (
            let i = 1;
            i < path.length;
            i++
        ) {

            d +=
                `L ${
                    path[i].X /
                    ESCALA_CLIPPER
                } ${
                    path[i].Y /
                    ESCALA_CLIPPER
                } `;
        }


        d +=
            "Z ";
    }


    return d.trim();
}


function pathClipperParaSvg(
    path
) {

    return clipperParaSvg(
        [path]
    );
}


// =====================================================
// RÉGUA HORIZONTAL
// =====================================================

function gerarReguaHorizontal(
    larguraMm
) {

    reguaHorizontal.innerHTML =
        "";


    reguaHorizontal.style.width =
        `${larguraMm * PX_POR_MM}px`;


    for (
        let mm = 0;
        mm <= larguraMm;
        mm++
    ) {

        const marca =
            document.createElement(
                "div"
            );


        marca.className =
            "tick-horizontal";


        if (
            mm % 10 === 0
        ) {

            marca.classList.add(
                "maior"
            );


            const label =
                document.createElement(
                    "span"
                );


            label.className =
                "label";


            label.textContent =
                mm;


            if (
                mm === 0
            ) {

                label.style.transform =
                    "translateX(2px)";
            }


            marca.appendChild(
                label
            );
        }

        else if (
            mm % 5 === 0
        ) {

            marca.classList.add(
                "medio"
            );
        }


        marca.style.left =
            `${mm * PX_POR_MM}px`;


        reguaHorizontal.appendChild(
            marca
        );
    }
}


// =====================================================
// RÉGUA VERTICAL
// =====================================================

function gerarReguaVertical(
    alturaMm
) {

    reguaVertical.innerHTML =
        "";


    reguaVertical.style.height =
        `${alturaMm * PX_POR_MM}px`;


    for (
        let mm = 0;
        mm <= alturaMm;
        mm++
    ) {

        const marca =
            document.createElement(
                "div"
            );


        marca.className =
            "tick-vertical";


        if (
            mm % 10 === 0
        ) {

            marca.classList.add(
                "maior"
            );


            const label =
                document.createElement(
                    "span"
                );


            label.className =
                "label";


            label.textContent =
                mm;


            if (
                mm === 0
            ) {

                label.style.top =
                    "2px";
            }


            marca.appendChild(
                label
            );
        }

        else if (
            mm % 5 === 0
        ) {

            marca.classList.add(
                "medio"
            );
        }


        marca.style.top =
            `${mm * PX_POR_MM}px`;


        reguaVertical.appendChild(
            marca
        );
    }
}


// =====================================================
// PRANCHETA MILIMETRADA
// =====================================================

function atualizarPrancheta(
    svgPreview,
    larguraPecaMm,
    alturaPecaMm
) {

    /*
        A prancheta sempre deixa margem ao redor
        da peça e cresce em múltiplos de 10 mm.
    */

    const larguraPranchetaMm =
        Math.max(

            100,

            Math.ceil(
                (
                    larguraPecaMm +
                    MARGEM_PRANCHETA_MM *
                    2
                ) /
                10
            ) *
            10
        );


    const alturaPranchetaMm =
        Math.max(

            50,

            Math.ceil(
                (
                    alturaPecaMm +
                    MARGEM_PRANCHETA_MM *
                    2
                ) /
                10
            ) *
            10
        );


    const larguraPranchetaPx =
        larguraPranchetaMm *
        PX_POR_MM;


    const alturaPranchetaPx =
        alturaPranchetaMm *
        PX_POR_MM;


    // -----------------------------------------
    // DIMENSÕES DA MESA
    // -----------------------------------------

    mesaMedicao.style.width =
        `${
            larguraPranchetaPx +
            LARGURA_REGUA_VERTICAL
        }px`;


    mesaMedicao.style.height =
        `${
            alturaPranchetaPx +
            ALTURA_REGUA_HORIZONTAL
        }px`;


    // -----------------------------------------
    // ÁREA DA GRADE
    // -----------------------------------------

    areaMedicao.style.width =
        `${larguraPranchetaPx}px`;


    areaMedicao.style.height =
        `${alturaPranchetaPx}px`;


    areaMedicao.style.setProperty(
        "--grid-1",
        `${PX_POR_MM}px`
    );


    areaMedicao.style.setProperty(
        "--grid-5",
        `${PX_POR_MM * 5}px`
    );


    areaMedicao.style.setProperty(
        "--grid-10",
        `${PX_POR_MM * 10}px`
    );


    // -----------------------------------------
    // TAMANHO DA PEÇA NA PRANCHETA
    // -----------------------------------------

    const larguraPecaPx =
        larguraPecaMm *
        PX_POR_MM;


    const alturaPecaPx =
        alturaPecaMm *
        PX_POR_MM;


    pecaPreview.style.width =
        `${larguraPecaPx}px`;


    pecaPreview.style.height =
        `${alturaPecaPx}px`;


    // -----------------------------------------
    // CENTRALIZAÇÃO
    // -----------------------------------------

    const esquerda =
        (
            larguraPranchetaPx -
            larguraPecaPx
        ) /
        2;


    const topo =
        (
            alturaPranchetaPx -
            alturaPecaPx
        ) /
        2;


    pecaPreview.style.left =
        `${esquerda}px`;


    pecaPreview.style.top =
        `${topo}px`;


    // -----------------------------------------
    // SVG
    // -----------------------------------------

    pecaPreview.innerHTML =
        svgPreview;


    // -----------------------------------------
    // MEDIDAS
    // -----------------------------------------

    medidasPreview.textContent =
        `↔ ${
            larguraPecaMm.toFixed(1)
        } mm   ↕ ${
            alturaPecaMm.toFixed(1)
        } mm`;


    // -----------------------------------------
    // RÉGUAS
    // -----------------------------------------

    gerarReguaHorizontal(
        larguraPranchetaMm
    );


    gerarReguaVertical(
        alturaPranchetaMm
    );
}


// =====================================================
// DOWNLOAD
// =====================================================

function baixarArquivoSvg(
    conteudoSvg,
    nomeArquivo
) {

    const conteudo =
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        conteudoSvg;


    const blob =
        new Blob(
            [conteudo],
            {
                type:
                    "image/svg+xml;charset=utf-8"
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement(
            "a"
        );


    link.href =
        url;


    link.download =
        nomeArquivo;


    document.body.appendChild(
        link
    );


    link.click();


    link.remove();


    URL.revokeObjectURL(
        url
    );
}


// =====================================================
// GERAÇÃO
// =====================================================

async function gerarSvg() {

    const meuId =
        ++geracaoAtual;


    const inicioTotal =
        performance.now();


    botaoBaixar.disabled =
        true;


    botaoBaixarDuplaCamada.disabled =
        true;


    try {

        const texto =
            inputTexto.value.trim();


        const tamanho =
            Number(
                inputTamanho.value
            );


        const borda =
            Number(
                inputBorda.value
            );


        const diametroFuro =
            Number(
                inputFuro.value
            );


        const espessuraArgola =
            Number(
                inputEspessuraArgola.value
            );


        const posicaoArgola =
            Number(
                inputPosicaoArgola.value
            );


        const alturaFinalMm =
            Number(
                inputAlturaFinal.value
            );


        const incluirPreenchimento =
            inputIncluirPreenchimento.checked;


        const caminhoFonte =
            selectFonte.value;


        valorPosicaoArgola.textContent =
            `${posicaoArgola.toFixed(1)}%`;


        // -----------------------------------------
        // VALIDAÇÃO
        // -----------------------------------------

        if (
            !texto
        ) {

            throw new Error(
                "Digite um texto."
            );
        }


        if (
            !Number.isFinite(
                tamanho
            ) ||
            tamanho <= 0
        ) {

            throw new Error(
                "Tamanho da fonte inválido."
            );
        }


        if (
            !Number.isFinite(
                alturaFinalMm
            ) ||
            alturaFinalMm <= 0
        ) {

            throw new Error(
                "Altura final inválida."
            );
        }


        // -----------------------------------------
        // FONTE
        // -----------------------------------------

        const fonte =
            await carregarFonte(
                caminhoFonte
            );


        if (
            meuId !==
            geracaoAtual
        ) {

            return;
        }


        // -----------------------------------------
        // TEXTO
        // -----------------------------------------

        const pathTexto =
            fonte.getPath(
                texto,
                0,
                0,
                tamanho
            );


        const pathDataTexto =
            pathTexto.toPathData(
                3
            );


        const bboxTexto =
            pathTexto.getBoundingBox();


        // -----------------------------------------
        // CONTORNO
        // -----------------------------------------

        const poligonos =
            pathParaPoligonos(
                pathTexto
            );


        let contorno =
            gerarContorno(
                poligonos,
                borda
            );


        contorno =
            apenasContornosExternos(
                contorno
            );


        if (
            !contorno.length
        ) {

            throw new Error(
                "Não foi possível gerar o contorno."
            );
        }


        // -----------------------------------------
        // ARGOLA
        // -----------------------------------------

        let contornoPrincipal =
            selecionarContornoPrincipal(
                contorno
            );


        contornoPrincipal =
            iniciarPathPelaEsquerda(
                contornoPrincipal
            );


        const posicao =
            pontoNoPerimetro(
                contornoPrincipal,
                posicaoArgola
            );


        const raioFuro =
            diametroFuro /
            2;


        const raioExterno =
            raioFuro +
            espessuraArgola;


        const sobreposicao =
            Math.max(
                1.5,
                espessuraArgola *
                0.7
            );


        const distanciaCentro =
            raioExterno -
            sobreposicao;


        const centroArgola = {

            x:
                posicao.x +
                posicao.normal.x *
                distanciaCentro,

            y:
                posicao.y +
                posicao.normal.y *
                distanciaCentro
        };


        const circuloExterno =
            criarCirculo(
                centroArgola.x,
                centroArgola.y,
                raioExterno
            );


        const larguraConector =
            raioExterno *
            1.25;


        const conector =
            criarConectorOrientado(
                posicao,
                centroArgola,
                posicao.tangente,
                larguraConector
            );


        let baseCompleta =
            unirPaths([

                ...contorno,

                circuloExterno,

                conector
            ]);


        baseCompleta =
            apenasContornosExternos(
                baseCompleta
            );


        const furo =
            criarCirculo(
                centroArgola.x,
                centroArgola.y,
                raioFuro
            );


        // -----------------------------------------
        // DIMENSÕES GEOMÉTRICAS
        // -----------------------------------------

        const bboxFinal =
            boundingBoxClipper(
                baseCompleta
            );


        const larguraPecaUnidades =
            bboxFinal.maxX -
            bboxFinal.minX;


        const alturaPecaUnidades =
            bboxFinal.maxY -
            bboxFinal.minY;


        // -----------------------------------------
        // ESCALA FÍSICA
        // -----------------------------------------

        const mmPorUnidade =
            alturaFinalMm /
            alturaPecaUnidades;


        const larguraFinalMm =
            larguraPecaUnidades *
            mmPorUnidade;


        dimensoesFinais.textContent =
            `Dimensões finais: ${
                larguraFinalMm.toFixed(1)
            } × ${
                alturaFinalMm.toFixed(1)
            } mm`;


        // -----------------------------------------
        // MARGEM DO ARQUIVO SVG
        // -----------------------------------------

        const margemMm =
            2;


        const margemUnidades =
            margemMm /
            mmPorUnidade;


        const viewX =
            bboxFinal.minX -
            margemUnidades;


        const viewY =
            bboxFinal.minY -
            margemUnidades;


        const viewLargura =
            larguraPecaUnidades +
            margemUnidades *
            2;


        const viewAltura =
            alturaPecaUnidades +
            margemUnidades *
            2;


        const documentoLarguraMm =
            viewLargura *
            mmPorUnidade;


        const documentoAlturaMm =
            viewAltura *
            mmPorUnidade;


        // -----------------------------------------
        // ESPESSURA DA LINHA
        // -----------------------------------------

        const espessuraLinhaMm =
            0.2;


        const espessuraLinhaUnidades =
            espessuraLinhaMm /
            mmPorUnidade;


        // -----------------------------------------
        // PATHS
        // -----------------------------------------

        const pathBase =
            clipperParaSvg(
                baseCompleta
            );


        const pathFuro =
            pathClipperParaSvg(
                furo
            );


        const preenchimentoTexto =
            incluirPreenchimento
                ? "#000000"
                : "none";


        // =================================================
        // SVG PARA DOWNLOAD
        // =================================================

        const novoSvg = `
<svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="${viewX} ${viewY} ${viewLargura} ${viewAltura}"
    width="${documentoLarguraMm.toFixed(3)}mm"
    height="${documentoAlturaMm.toFixed(3)}mm"
    preserveAspectRatio="xMinYMin meet"
>

    <path
        id="corte"
        d="${pathBase} ${pathFuro}"
        fill="none"
        stroke="#FF0000"
        stroke-width="${espessuraLinhaUnidades}"
        stroke-linejoin="round"
        stroke-linecap="round"
        fill-rule="evenodd"
    />


    <path
        id="letras"
        d="${pathDataTexto}"
        fill="${preenchimentoTexto}"
        stroke="#0000FF"
        stroke-width="${espessuraLinhaUnidades}"
        stroke-linejoin="round"
        stroke-linecap="round"
        fill-rule="evenodd"
    />

</svg>
        `.trim();


        // =================================================
        // SVG EXCLUSIVO PARA A PRANCHETA
        //
        // Aqui NÃO há margem externa.
        // Assim o desenho ocupa exatamente:
        //
        // larguraFinalMm × alturaFinalMm
        // =================================================

        const svgPreview = `
<svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="${bboxFinal.minX} ${bboxFinal.minY} ${larguraPecaUnidades} ${alturaPecaUnidades}"
    width="100%"
    height="100%"
    preserveAspectRatio="xMidYMid meet"
>

    <path
        d="${pathBase} ${pathFuro}"
        fill="none"
        stroke="#FF0000"
        stroke-width="${espessuraLinhaUnidades}"
        stroke-linejoin="round"
        stroke-linecap="round"
        fill-rule="evenodd"
    />


    <path
        d="${pathDataTexto}"
        fill="${preenchimentoTexto}"
        stroke="#0000FF"
        stroke-width="${espessuraLinhaUnidades}"
        stroke-linejoin="round"
        stroke-linecap="round"
        fill-rule="evenodd"
    />

</svg>
        `.trim();


        // =================================================
        // SVG DUPLA CAMADA
        // =================================================

        const distanciaCamadasMm =
            8;


        const distanciaCamadasUnidades =
            distanciaCamadasMm /
            mmPorUnidade;


        const deslocamentoY =
            bboxFinal.maxY +
            distanciaCamadasUnidades -
            bboxTexto.y1;


        const textoInferiorMaxY =
            bboxTexto.y2 +
            deslocamentoY;


        const duplaMinX =
            Math.min(
                bboxFinal.minX,
                bboxTexto.x1
            );


        const duplaMaxX =
            Math.max(
                bboxFinal.maxX,
                bboxTexto.x2
            );


        const duplaMinY =
            bboxFinal.minY;


        const duplaMaxY =
            Math.max(
                bboxFinal.maxY,
                textoInferiorMaxY
            );


        const duplaViewX =
            duplaMinX -
            margemUnidades;


        const duplaViewY =
            duplaMinY -
            margemUnidades;


        const duplaViewLargura =
            (
                duplaMaxX -
                duplaMinX
            ) +
            margemUnidades *
            2;


        const duplaViewAltura =
            (
                duplaMaxY -
                duplaMinY
            ) +
            margemUnidades *
            2;


        const duplaDocumentoLarguraMm =
            duplaViewLargura *
            mmPorUnidade;


        const duplaDocumentoAlturaMm =
            duplaViewAltura *
            mmPorUnidade;


        const novoSvgDuplaCamada = `
<svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="${duplaViewX} ${duplaViewY} ${duplaViewLargura} ${duplaViewAltura}"
    width="${duplaDocumentoLarguraMm.toFixed(3)}mm"
    height="${duplaDocumentoAlturaMm.toFixed(3)}mm"
    preserveAspectRatio="xMinYMin meet"
>

    <g id="camada-chaveiro">

        <path
            id="corte-chaveiro"
            d="${pathBase} ${pathFuro}"
            fill="none"
            stroke="#FF0000"
            stroke-width="${espessuraLinhaUnidades}"
            stroke-linejoin="round"
            stroke-linecap="round"
            fill-rule="evenodd"
        />


        <path
            id="letras-chaveiro"
            d="${pathDataTexto}"
            fill="${preenchimentoTexto}"
            stroke="#0000FF"
            stroke-width="${espessuraLinhaUnidades}"
            stroke-linejoin="round"
            stroke-linecap="round"
            fill-rule="evenodd"
        />

    </g>


    <g
        id="camada-letras-corte"
        transform="translate(0 ${deslocamentoY})"
    >

        <path
            id="letras-corte"
            d="${pathDataTexto}"
            fill="none"
            stroke="#FF0000"
            stroke-width="${espessuraLinhaUnidades}"
            stroke-linejoin="round"
            stroke-linecap="round"
            fill-rule="evenodd"
        />

    </g>

</svg>
        `.trim();


        // -----------------------------------------
        // EVITA CORRIDA ENTRE GERAÇÕES
        // -----------------------------------------

        if (
            meuId !==
            geracaoAtual
        ) {

            return;
        }


        // -----------------------------------------
        // SALVA
        // -----------------------------------------

        svgGerado =
            novoSvg;


        svgGeradoDuplaCamada =
            novoSvgDuplaCamada;


        // -----------------------------------------
        // PRANCHETA
        // -----------------------------------------

        atualizarPrancheta(
            svgPreview,
            larguraFinalMm,
            alturaFinalMm
        );


        // -----------------------------------------
        // BOTÕES
        // -----------------------------------------

        botaoBaixar.disabled =
            false;


        botaoBaixarDuplaCamada.disabled =
            false;


        // -----------------------------------------
        // TEMPO
        // -----------------------------------------

        const fimTotal =
            performance.now();


        mensagem.textContent =
            `Chaveiro gerado em ${
                (
                    fimTotal -
                    inicioTotal
                ).toFixed(0)
            } ms.`;

    }

    catch (erro) {

        console.error(
            erro
        );


        if (
            meuId ===
            geracaoAtual
        ) {

            mensagem.textContent =
                "Erro: " +
                erro.message;


            botaoBaixar.disabled =
                true;


            botaoBaixarDuplaCamada.disabled =
                true;
        }
    }
}


// =====================================================
// NOMES DOS ARQUIVOS
// =====================================================

function nomeSeguro() {

    return inputTexto.value
        .trim()
        .replace(
            /\s+/g,
            "_"
        );
}


// =====================================================
// DOWNLOAD NORMAL
// =====================================================

function baixarSvg() {

    if (
        !svgGerado
    ) {

        return;
    }


    baixarArquivoSvg(
        svgGerado,
        `${nomeSeguro()}_chaveiro.svg`
    );
}


// =====================================================
// DOWNLOAD DUPLA CAMADA
// =====================================================

function baixarSvgDuplaCamada() {

    if (
        !svgGeradoDuplaCamada
    ) {

        return;
    }


    baixarArquivoSvg(
        svgGeradoDuplaCamada,
        `${nomeSeguro()}_chaveiro_dupla_camada.svg`
    );
}


// =====================================================
// ATUALIZAÇÃO COM REQUESTANIMATIONFRAME
// =====================================================

let frameAtualizacao =
    null;


function solicitarAtualizacao() {

    if (
        frameAtualizacao !== null
    ) {

        return;
    }


    frameAtualizacao =
        requestAnimationFrame(

            () => {

                frameAtualizacao =
                    null;


                gerarSvg();
            }
        );
}


// =====================================================
// EVENTOS
// =====================================================

botaoGerar.addEventListener(
    "click",
    gerarSvg
);


botaoBaixar.addEventListener(
    "click",
    baixarSvg
);


botaoBaixarDuplaCamada.addEventListener(
    "click",
    baixarSvgDuplaCamada
);


inputTexto.addEventListener(
    "input",
    solicitarAtualizacao
);


inputTamanho.addEventListener(
    "input",
    solicitarAtualizacao
);


inputBorda.addEventListener(
    "input",
    solicitarAtualizacao
);


inputFuro.addEventListener(
    "input",
    solicitarAtualizacao
);


inputEspessuraArgola.addEventListener(
    "input",
    solicitarAtualizacao
);


inputAlturaFinal.addEventListener(
    "input",
    solicitarAtualizacao
);


inputPosicaoArgola.addEventListener(
    "input",
    () => {

        valorPosicaoArgola.textContent =
            `${
                Number(
                    inputPosicaoArgola.value
                ).toFixed(1)
            }%`;


        solicitarAtualizacao();
    }
);


inputIncluirPreenchimento.addEventListener(
    "change",
    gerarSvg
);


selectFonte.addEventListener(
    "change",
    gerarSvg
);


// =====================================================
// INICIALIZAÇÃO
// =====================================================

window.addEventListener(
    "load",
    gerarSvg
);