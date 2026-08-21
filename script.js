// =====================================================
// INTERFACE
// =====================================================

const inputTexto = document.getElementById("texto");
const selectFonte = document.getElementById("fonte");

const inputTamanho = document.getElementById("tamanho");
const inputBorda = document.getElementById("borda");

const inputFuro = document.getElementById("furo");

const inputEspessuraArgola =
    document.getElementById("espessuraArgola");

const inputPosicaoArgola =
    document.getElementById("posicaoArgola");

const valorPosicaoArgola =
    document.getElementById("valorPosicaoArgola");

const inputIncluirPreenchimento =
    document.getElementById("incluirPreenchimento");

const botaoGerar =
    document.getElementById("gerar");

const botaoBaixar =
    document.getElementById("baixar");

const botaoBaixarDuplaCamada =
    document.getElementById("baixarDuplaCamada");

const preview =
    document.getElementById("preview");

const mensagem =
    document.getElementById("mensagem");


// Maior resolução do slider

inputPosicaoArgola.step = "0.1";


// =====================================================
// ESTADO
// =====================================================

let svgGerado = "";

let svgGeradoDuplaCamada = "";

const cacheFontes = new Map();

const fontesEmCarregamento = new Map();

const ESCALA_CLIPPER = 1000;


// Identificador da geração mais recente

let geracaoAtual = 0;


// =====================================================
// CARREGAMENTO DA FONTE
// =====================================================

function carregarFonte(caminho) {

    if (cacheFontes.has(caminho)) {

        return Promise.resolve(
            cacheFontes.get(caminho)
        );
    }


    if (fontesEmCarregamento.has(caminho)) {

        return fontesEmCarregamento.get(
            caminho
        );
    }


    const inicio =
        performance.now();


    mensagem.textContent =
        "Carregando fonte...";


    const promessa =
        new Promise((resolve, reject) => {

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


                    const fim =
                        performance.now();


                    console.log(
                        `Fonte carregada em ${
                            (fim - inicio).toFixed(1)
                        } ms`
                    );


                    cacheFontes.set(
                        caminho,
                        fonte
                    );


                    resolve(fonte);
                }
            );
        });


    fontesEmCarregamento.set(
        caminho,
        promessa
    );


    return promessa;
}


// =====================================================
// CURVA QUADRÁTICA
// =====================================================

function pontoQuadratico(
    p0,
    p1,
    p2,
    t
) {

    const mt = 1 - t;


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


// =====================================================
// CURVA CÚBICA
// =====================================================

function pontoCubico(
    p0,
    p1,
    p2,
    p3,
    t
) {

    const mt = 1 - t;


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

    const poligonos = [];

    let atual = [];

    let pontoAtual = null;

    const segmentosCurva = 12;


    function finalizar() {

        if (atual.length >= 3) {

            poligonos.push(
                atual
            );
        }


        atual = [];

        pontoAtual = null;
    }


    for (const cmd of path.commands) {

        // MOVE

        if (cmd.type === "M") {

            if (atual.length >= 3) {

                finalizar();
            }


            pontoAtual = {

                x: cmd.x,
                y: cmd.y
            };


            atual.push({

                ...pontoAtual
            });
        }


        // LINE

        else if (cmd.type === "L") {

            pontoAtual = {

                x: cmd.x,
                y: cmd.y
            };


            atual.push({

                ...pontoAtual
            });
        }


        // QUADRÁTICA

        else if (cmd.type === "Q") {

            const inicio = {

                ...pontoAtual
            };


            const controle = {

                x: cmd.x1,
                y: cmd.y1
            };


            const fim = {

                x: cmd.x,
                y: cmd.y
            };


            for (
                let i = 1;
                i <= segmentosCurva;
                i++
            ) {

                const t =
                    i / segmentosCurva;


                atual.push(

                    pontoQuadratico(
                        inicio,
                        controle,
                        fim,
                        t
                    )
                );
            }


            pontoAtual = fim;
        }


        // CÚBICA

        else if (cmd.type === "C") {

            const inicio = {

                ...pontoAtual
            };


            const controle1 = {

                x: cmd.x1,
                y: cmd.y1
            };


            const controle2 = {

                x: cmd.x2,
                y: cmd.y2
            };


            const fim = {

                x: cmd.x,
                y: cmd.y
            };


            for (
                let i = 1;
                i <= segmentosCurva;
                i++
            ) {

                const t =
                    i / segmentosCurva;


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


            pontoAtual = fim;
        }


        // CLOSE

        else if (cmd.type === "Z") {

            if (atual.length >= 3) {

                finalizar();
            }
        }
    }


    if (atual.length >= 3) {

        finalizar();
    }


    return poligonos;
}


// =====================================================
// CONVERTE PARA CLIPPER
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


// =====================================================
// UNIÃO DE POLÍGONOS
// =====================================================

function unirPaths(paths) {

    const clipper =
        new ClipperLib.Clipper();


    clipper.AddPaths(
        paths,
        ClipperLib.PolyType.ptSubject,
        true
    );


    const resultado = [];


    clipper.Execute(
        ClipperLib.ClipType.ctUnion,
        resultado,
        ClipperLib.PolyFillType.pftNonZero,
        ClipperLib.PolyFillType.pftNonZero
    );


    return resultado;
}


// =====================================================
// GERA CONTORNO
// =====================================================

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


    const resultado = [];


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
// POLÍGONO DENTRO DE OUTRO
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


// =====================================================
// REMOVE CONTORNOS INTERNOS
// =====================================================

function apenasContornosExternos(paths) {

    return paths.filter(

        (path, indice) => {

            for (
                let i = 0;
                i < paths.length;
                i++
            ) {

                if (i === indice) {

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
// CRIA CÍRCULO
// =====================================================

function criarCirculo(
    cx,
    cy,
    raio,
    segmentos = 72
) {

    const path = [];


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
                        Math.cos(angulo)
                    ) *
                    ESCALA_CLIPPER
                ),

            Y:
                Math.round(
                    (
                        cy +
                        raio *
                        Math.sin(angulo)
                    ) *
                    ESCALA_CLIPPER
                )
        });
    }


    return path;
}


// =====================================================
// ÁREA DO POLÍGONO
// =====================================================

function areaPath(path) {

    let area = 0;


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
            p1.X * p2.Y -
            p2.X * p1.Y;
    }


    return area / 2;
}


// =====================================================
// CONTORNO PRINCIPAL
// =====================================================

function selecionarContornoPrincipal(
    paths
) {

    if (!paths.length) {

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


        if (area > maiorArea) {

            maiorArea = area;

            principal =
                paths[i];
        }
    }


    return principal;
}


// =====================================================
// FAZ 0% COMEÇAR NA ESQUERDA
// =====================================================

function iniciarPathPelaEsquerda(
    path
) {

    if (
        !path ||
        !path.length
    ) {

        return path;
    }


    let minX = Infinity;

    let minY = Infinity;

    let maxY = -Infinity;


    for (const p of path) {

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
        ) / 2;


    let indice = 0;

    let melhorDistancia =
        Infinity;


    const tolerancia =
        1.5 *
        ESCALA_CLIPPER;


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

                indice = i;
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
// CONSTRÓI PERÍMETRO
// =====================================================

function construirPerimetro(path) {

    const segmentos = [];

    let comprimentoTotal = 0;


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


// =====================================================
// PONTO EM UMA DISTÂNCIA DO PERÍMETRO
// =====================================================

function pontoNaDistancia(
    segmentos,
    comprimentoTotal,
    distancia
) {

    if (
        comprimentoTotal <= 0
    ) {

        return null;
    }


    let d =
        distancia %
        comprimentoTotal;


    if (d < 0) {

        d +=
            comprimentoTotal;
    }


    for (const segmento of segmentos) {

        const fim =
            segmento.inicio +
            segmento.comprimento;


        if (d <= fim) {

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
// NORMALIZA VETOR
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
// PONTO AO LONGO DO PERÍMETRO
// COM MOVIMENTO SUAVIZADO
// =====================================================

function pontoNoPerimetro(
    path,
    percentual
) {

    if (
        !path ||
        path.length < 2
    ) {

        return null;
    }


    const {

        segmentos,

        comprimentoTotal

    } =
        construirPerimetro(
            path
        );


    if (
        comprimentoTotal <= 0
    ) {

        return null;
    }


    let fracao =
        percentual /
        100;


    if (fracao >= 1) {

        fracao = 0;
    }


    if (fracao < 0) {

        fracao = 0;
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


    if (!pontoAtual) {

        return null;
    }


    // =================================================
    // JANELA DE SUAVIZAÇÃO
    // =================================================

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
        distanciaJanela
    ) {

        const anterior =
            pontoNaDistancia(

                segmentos,

                comprimentoTotal,

                distanciaAtual -
                distanciaJanela
            );


        const posterior =
            pontoNaDistancia(

                segmentos,

                comprimentoTotal,

                distanciaAtual +
                distanciaJanela
            );


        if (
            !anterior ||
            !posterior
        ) {

            return null;
        }


        return normalizarVetor(

            posterior.X -
            anterior.X,

            posterior.Y -
            anterior.Y
        );
    }


    // =================================================
    // TRÊS ESCALAS
    // =================================================

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


    if (
        !tangenteCurta ||
        !tangenteMedia ||
        !tangenteLonga
    ) {

        return null;
    }


    // =================================================
    // MÉDIA PONDERADA
    // =================================================

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


    if (!tangente) {

        return null;
    }


    // =================================================
    // NORMAL EXTERNA
    // =================================================

    const area =
        areaPath(
            path
        );


    let normalExterna;


    if (area > 0) {

        normalExterna = {

            x:
                tangente.y,

            y:
                -tangente.x
        };
    }

    else {

        normalExterna = {

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

        normal:
            normalExterna
    };
}


// =====================================================
// CONECTOR ORIENTADO
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

    let minX = Infinity;
    let minY = Infinity;

    let maxX = -Infinity;
    let maxY = -Infinity;


    for (const path of paths) {

        for (const ponto of path) {

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

function clipperParaSvg(paths) {

    let d = "";


    for (const path of paths) {

        if (!path.length) {

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


// =====================================================
// UM PATH CLIPPER → SVG
// =====================================================

function pathClipperParaSvg(path) {

    if (!path.length) {

        return "";
    }


    let d =
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


    d += "Z";


    return d;
}


// =====================================================
// GERA CHAVEIRO
// =====================================================

async function gerarSvg() {

    const meuId =
        ++geracaoAtual;


    const inicioTotal =
        performance.now();


    // Enquanto gera, evita download de versão antiga

    botaoBaixar.disabled =
        true;


    botaoBaixarDuplaCamada.disabled =
        true;


    try {

        // =================================================
        // PARÂMETROS
        // =================================================

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


        const incluirPreenchimento =
            inputIncluirPreenchimento.checked;


        const caminhoFonte =
            selectFonte.value;


        valorPosicaoArgola.textContent =
            `${posicaoArgola.toFixed(1)}%`;


        // =================================================
        // VALIDAÇÕES
        // =================================================

        if (!texto) {

            mensagem.textContent =
                "Digite um texto.";

            return;
        }


        if (
            !Number.isFinite(tamanho) ||
            tamanho <= 0
        ) {

            mensagem.textContent =
                "Tamanho inválido.";

            return;
        }


        if (
            !Number.isFinite(borda) ||
            borda <= 0
        ) {

            mensagem.textContent =
                "Borda inválida.";

            return;
        }


        if (
            !Number.isFinite(diametroFuro) ||
            diametroFuro <= 0
        ) {

            mensagem.textContent =
                "Diâmetro do furo inválido.";

            return;
        }


        if (
            !Number.isFinite(espessuraArgola) ||
            espessuraArgola <= 0
        ) {

            mensagem.textContent =
                "Espessura da argola inválida.";

            return;
        }


        // =================================================
        // FONTE
        // =================================================

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


        // =================================================
        // TEXTO
        // =================================================

        const pathTexto =
            fonte.getPath(
                texto,
                0,
                0,
                tamanho
            );


        const pathDataTexto =
            pathTexto.toPathData(3);


        // =================================================
        // POLÍGONOS
        // =================================================

        const poligonos =
            pathParaPoligonos(
                pathTexto
            );


        // =================================================
        // CONTORNO DO CHAVEIRO
        // =================================================

        let contorno =
            gerarContorno(
                poligonos,
                borda
            );


        contorno =
            apenasContornosExternos(
                contorno
            );


        if (!contorno.length) {

            throw new Error(
                "Não foi possível gerar o contorno."
            );
        }


        // =================================================
        // TRILHO DA ARGOLA
        // =================================================

        let contornoPrincipal =
            selecionarContornoPrincipal(
                contorno
            );


        if (!contornoPrincipal) {

            throw new Error(
                "Não foi possível localizar o contorno principal."
            );
        }


        contornoPrincipal =
            iniciarPathPelaEsquerda(
                contornoPrincipal
            );


        // =================================================
        // POSIÇÃO DA ARGOLA
        // =================================================

        const posicao =
            pontoNoPerimetro(
                contornoPrincipal,
                posicaoArgola
            );


        if (!posicao) {

            throw new Error(
                "Não foi possível calcular a posição da argola."
            );
        }


        // =================================================
        // DIMENSÕES DA ARGOLA
        // =================================================

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


        // =================================================
        // CENTRO DA ARGOLA
        // =================================================

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


        // =================================================
        // CÍRCULO EXTERNO
        // =================================================

        const circuloExterno =
            criarCirculo(
                centroArgola.x,
                centroArgola.y,
                raioExterno
            );


        // =================================================
        // CONECTOR
        // =================================================

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


        // =================================================
        // UNE BASE + ARGOLA
        // =================================================

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


        // =================================================
        // FURO
        // =================================================

        const furo =
            criarCirculo(
                centroArgola.x,
                centroArgola.y,
                raioFuro
            );


        // =================================================
        // PATHS
        // =================================================

        const pathBase =
            clipperParaSvg(
                baseCompleta
            );


        const pathFuro =
            pathClipperParaSvg(
                furo
            );


        // =================================================
        // VIEWBOX DO CHAVEIRO NORMAL
        // =================================================

        const bboxFinal =
            boundingBoxClipper(
                baseCompleta
            );


        const margem = 5;


        const x =
            bboxFinal.minX -
            margem;


        const y =
            bboxFinal.minY -
            margem;


        const largura =
            bboxFinal.maxX -
            bboxFinal.minX +
            margem * 2;


        const altura =
            bboxFinal.maxY -
            bboxFinal.minY +
            margem * 2;


        // =================================================
        // PREENCHIMENTO
        // =================================================

        const preenchimentoTexto =
            incluirPreenchimento
                ? "#000000"
                : "none";


        // =================================================
        // SVG NORMAL
        //
        // VERMELHO = corte
        // AZUL = contorno das letras
        // PRETO = preenchimento
        // =================================================

        const novoSvg = `
<svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="${x} ${y} ${largura} ${altura}"
    width="100%"
    height="100%"
>

    <!-- CORTE EXTERNO + FURO -->

    <path
        id="corte"
        d="${pathBase} ${pathFuro}"
        fill="none"
        stroke="#FF0000"
        stroke-width="0.5"
        stroke-linejoin="round"
        stroke-linecap="round"
        fill-rule="evenodd"
    />


    <!-- LETRAS -->

    <path
        id="letras"
        d="${pathDataTexto}"
        fill="${preenchimentoTexto}"
        stroke="#0000FF"
        stroke-width="0.5"
        stroke-linejoin="round"
        stroke-linecap="round"
        fill-rule="evenodd"
    />

</svg>
        `.trim();


        // =================================================
        // SVG DUPLA CAMADA
        //
        // PARTE DE CIMA:
        // chaveiro normal
        //
        // PARTE DE BAIXO:
        // letras sem preenchimento
        // com contorno vermelho para corte
        // =================================================

        const distanciaEntreCamadas =
            10;


        const deslocamentoY =
            altura +
            distanciaEntreCamadas;


        const alturaDupla =
            altura * 2 +
            distanciaEntreCamadas;


        const novoSvgDuplaCamada = `
<svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="${x} ${y} ${largura} ${alturaDupla}"
    width="100%"
    height="100%"
>

    <!-- ================================= -->
    <!-- CAMADA 1                          -->
    <!-- CHAVEIRO COMPLETO                 -->
    <!-- ================================= -->

    <g id="camada-chaveiro">

        <!-- Corte externo + furo -->

        <path
            id="corte-chaveiro"
            d="${pathBase} ${pathFuro}"
            fill="none"
            stroke="#FF0000"
            stroke-width="0.5"
            stroke-linejoin="round"
            stroke-linecap="round"
            fill-rule="evenodd"
        />


        <!-- Letras da camada principal -->

        <path
            id="letras-chaveiro"
            d="${pathDataTexto}"
            fill="${preenchimentoTexto}"
            stroke="#0000FF"
            stroke-width="0.5"
            stroke-linejoin="round"
            stroke-linecap="round"
            fill-rule="evenodd"
        />

    </g>


    <!-- ================================= -->
    <!-- CAMADA 2                          -->
    <!-- LETRAS PARA CORTE                 -->
    <!-- ================================= -->

    <g
        id="camada-letras-corte"
        transform="translate(0 ${deslocamentoY})"
    >

        <path
            id="letras-corte"
            d="${pathDataTexto}"
            fill="none"
            stroke="#FF0000"
            stroke-width="0.5"
            stroke-linejoin="round"
            stroke-linecap="round"
            fill-rule="evenodd"
        />

    </g>

</svg>
        `.trim();


        // =================================================
        // NÃO PERMITE GERAÇÃO ANTIGA SOBRESCREVER NOVA
        // =================================================

        if (
            meuId !==
            geracaoAtual
        ) {

            return;
        }


        // =================================================
        // SALVA AS DUAS VERSÕES
        // =================================================

        svgGerado =
            novoSvg;


        svgGeradoDuplaCamada =
            novoSvgDuplaCamada;


        // =================================================
        // PREVIEW
        //
        // Mantemos a visualização normal.
        // A versão dupla só aparece no arquivo baixado.
        // =================================================

        preview.innerHTML =
            svgGerado;


        botaoBaixar.disabled =
            false;


        botaoBaixarDuplaCamada.disabled =
            false;


        // =================================================
        // TEMPO
        // =================================================

        const fimTotal =
            performance.now();


        const tempo =
            fimTotal -
            inicioTotal;


        mensagem.textContent =
            `Chaveiro gerado em ${
                tempo.toFixed(0)
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
// DOWNLOAD SVG NORMAL
// =====================================================

function baixarSvg() {

    if (!svgGerado) {

        return;
    }


    const texto =
        inputTexto.value
            .trim()
            .replace(
                /\s+/g,
                "_"
            );


    const nomeArquivo =
        `${texto}_chaveiro.svg`;


    const conteudo =
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        svgGerado;


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
// DOWNLOAD SVG DUPLA CAMADA
// =====================================================

function baixarSvgDuplaCamada() {

    if (!svgGeradoDuplaCamada) {

        return;
    }


    const texto =
        inputTexto.value
            .trim()
            .replace(
                /\s+/g,
                "_"
            );


    const nomeArquivo =
        `${texto}_chaveiro_dupla_camada.svg`;


    const conteudo =
        '<?xml version="1.0" encoding="UTF-8"?>\n' +
        svgGeradoDuplaCamada;


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
// ATUALIZAÇÃO SINCRONIZADA COM A TELA
// =====================================================

let frameAtualizacao = null;


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


selectFonte.addEventListener(
    "change",
    gerarSvg
);


// =====================================================
// CHECKBOX PREENCHIMENTO
// =====================================================

inputIncluirPreenchimento.addEventListener(
    "change",
    gerarSvg
);


// =====================================================
// SLIDER DA ARGOLA
// =====================================================

inputPosicaoArgola.addEventListener(
    "input",
    () => {

        const valor =
            Number(
                inputPosicaoArgola.value
            );


        valorPosicaoArgola.textContent =
            `${valor.toFixed(1)}%`;


        solicitarAtualizacao();
    }
);


// =====================================================
// INICIALIZAÇÃO
// =====================================================

window.addEventListener(
    "load",
    gerarSvg
);