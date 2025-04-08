return;
class BlockDefinition {
    constructor(id) {
        this.id = id;
        this.name = id;
        this.description = id;
        this.shape = "[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0]";
        this.angles = "[-180,-90,0,90,180]";
        this.imagePath = id + ".png";    
    }
}

exports.modinfo = {
    name: "ll-blocks",
    version: "0.1.1",
    dependencies: [],
    modauthor: "STBlade & TomTheFurry",
};
function MakePatches(libloader, blocks, startId) {
    let ids = [];
    var blockTypeString = "";
    var inventoryString = "";
    var blockShapesString = "";
    var placementString = "";
    var imageString = "";
    var loadTextureString = "";
    var drawTextureString = "";
    var id = startId;
    for (let B of blocks) {
        ids.push(++id);
        blockTypeString = blockTypeString + `,V[V.${B.id}=${id}]="${B.id}"`;
        inventoryString = inventoryString + `,d.${B.id}`;
        blockShapesString = blockShapesString + `,"${B.id}":[${B.shape}]`;
        placementString = placementString + `,Vh[d.${B.id}]={shape:ud["${B.id}"],variants:[{id:d.${B.id},angles:${B.angles}}],name:"${B.name}",description:"${B.description}"}`;
        var nameWithoutExtension = B.imagePath.split(".")[0];
        globalThis.logInfo(`ll-blocks: Registering image ${B.imagePath} as ${nameWithoutExtension}`);
        console.log(B);
        imageString = imageString + `,Rf[d.${B.id}]={imageName:"${nameWithoutExtension}"}`;
        loadTextureString = loadTextureString + `,sm("${nameWithoutExtension}")`;
        drawTextureString = drawTextureString + `d.${nameWithoutExtension},`;
    }
    drawTextureString = drawTextureString.substring(0, drawTextureString.length - 1);

    var patches = [{
            // Add block types
            type: "replace",
            from: `V[V.GloomEmitter=27]="GloomEmitter"`,
            to: `V[V.GloomEmitter=27]="GloomEmitter"${blockTypeString}`,
            expectedMatches: 1,
        }, {
            // Add inventory
            type: "replace",
            from: `d.Foundation,d.Collector`,
            to: `d.Foundation${inventoryString},d.Collector`,
            expectedMatches: 1,
        }, {
            // Add block shapes
            type: "replace",
            from: `"grower":[[12,12,12,12],[0,0,0,0],[0,0,0,0],[0,0,0,0]]`,
            to: `"grower":[[12,12,12,12],[0,0,0,0],[0,0,0,0],[0,0,0,0]]${blockShapesString}`,
            expectedMatches: 1,
        }, {
            // Add blocks and placement
            type: "replace",
            from: `Vh[d.FoundationAngledRight]={shape:ud["foundation-triangle-right"]}`,
            to: `Vh[d.FoundationAngledRight]={shape:ud["foundation-triangle-right"]}${placementString}`,
            expectedMatches: 1,
        }, {
            // Add images
            type: "replace",
            from: `Rf[d.Foundation]={imageName:"block"}`,
            to: `Rf[d.Foundation]={imageName:"block"}${imageString}`,
            expectedMatches: 1,
        }, {
            // Load texture
            type: "replace",
            from: `sm("frame_block")`,
            to: `sm("frame_block")${loadTextureString}`,
            expectedMatches: 1,
        }, {
            // Draw textures
            type: "replace",
            from: `if(n.type!==d.Collector)`,
            to: `if([${drawTextureString}].includes(n.type)){f=zf[n.type];l=t.session.rendering.images[f.imageName],(u=e.snapGridCellSize * e.cellSize),(c=Nf(t,n.x*e.cellSize,n.y*e.cellSize));h.drawImage(l.image,0,0,e.snapGridCellSize,e.snapGridCellSize,c.x,c.y,u,u);}else if(n.type!==d.Collector)`,
            expectedMatches: 1,
        },
    ];
    libloader.AddPatches(patches);
}

exports.LibLoaderEvents = {
    apiInit: function (libloader) {
        return new {
            id: "llBlocks",
            images: {}, // path to base64 image data
            blocks: [], // BlockDefinition[]
            registerImage: function (path, data) {
                // check path is valid file name path
                if (!path.match(/^[a-zA-Z0-9_\-]+\.([a-zA-Z0-9]+)$/)) {
                    throw new Error("Invalid image path: " + path);
                }
                if (this.images[path]) {
                    throw new Error("Image already registered: " + path);
                }
                this.images[path] = data;
            },

            registerBlock: function (block) {
                this.blocks.push(block);
            },

            finalize: function () {
                // output image loader hooks
                globalThis.logInfo(`ll-blocks: Registering ${Object.keys(this.images).length} images`);
                var combinedImgHooks = {};
                globalThis.logInfo(`ll-blocks: Registering image ${this.images}`);
                console.log(this.images);
                for (const path in this.images) {
                    var data = this.images[path];
                    var type = "";
                    // TODO: Someone gotta test what the game actually supports
                    var ext = path.split(".").pop().toLowerCase();
                    globalThis.logInfo(`ll-blocks: Registering image ${path}`);
                    switch (ext) {
                        case "png":
                            type = "image/png";
                            break;
                        case "jpg":
                        case "jpeg":
                            type = "image/jpeg";
                            break;
                        case "gif":
                            type = "image/gif";
                            break;
                        case "webp":
                            type = "image/webp";
                            break;
                        case "svg":
                            type = "image/svg+xml";
                            break;
                        case "bmp":
                            type = "image/bmp";
                            break;
                        default:
                            throw new Error("Unknown image type: " + path);
                    }
                    combinedImgHooks[path] = {
                        requiresBaseResponse: false,
                        getFinalResponse: async() => {
                            return {
                                body: data,
                                contentType: type,
                            };
                        },
                    };
                    globalThis.logInfo(`ll-blocks: Hooked image ${path} of type ${type}`);
                };
                console.log(combinedImgHooks);
                libloader.AddHooks(combinedImgHooks);
                if (this.blocks.length > 0) {
                    globalThis.logInfo(`ll-blocks: Registering ${this.blocks.length} blocks`);
                    MakePatches(libloader, this.blocks, 99); // todo: startId
                }
            }
        }
    }
}

function MakeImageLoader(imageData) {
    return {
        requiresBaseResponse: false,
        getFinalResponse: async() => {
            return {
                body: imageData,
                contentType: "image/png",
            };
        },
    };
}