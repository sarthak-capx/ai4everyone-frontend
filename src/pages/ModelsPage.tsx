import React, { useState } from 'react';
import { Table, LayoutGrid } from 'lucide-react';
import { MODEL_OPTIONS } from '../models';
import { Link, useNavigate } from 'react-router-dom';
import { getModelPricing, isFalModel } from '../utils/pricing';
import ViewDocumentationCard from '../components/ViewDocumentationCard';
import { getModelImage, getModelDescription, logoMap, extractCategoryFromLabel } from '../constants/modelMeta';

const ModelsPage = React.memo(() => {
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
    const [selectedCategory, setSelectedCategory] = useState<string>('All');

    // Helper function to determine if a model has fixed or usage-based pricing
    const getPricingType = (modelValue: string): string => {
        const pricing = getModelPricing(modelValue);
        if (!pricing) return 'Usage-based'; // Default for models without pricing data (like text models)

        // Fixed pricing types
        if (pricing.type === 'flat' || pricing.type === 'image') {
            return 'Fixed';
        }

        // Usage-based pricing types
        return 'Usage-based';
    };

    // Helper function to get formatted price for each model - FIXED TO MATCH BACKEND
    const getModelPrice = (modelValue: string): string => {
        const pricing = getModelPricing(modelValue);
        if (!pricing) return 'Token-based'; // Default for text models
        const rate = (pricing.rate * (isFalModel(modelValue) ? 1.2 : 1)).toFixed(3);
        switch (pricing.type) {
            case 'flat':
                return `$${rate} per ${pricing.unit}`;
            case 'image':
                return `$${rate} per image`;
            case 'megapixel':
                return `$${rate} per MP`;
            case 'video_duration':
                return `$${rate} per second`;
            case 'time':
                if (pricing.multiplier === 30) {
                    return `$${rate}/30s`;
                } else if (pricing.multiplier === 60) {
                    return `$${rate}/minute`;
                }
                return `$${rate} per second`;
            case 'audio_duration':
                if (pricing.multiplier === 60) {
                    return `$${rate} per minute`;
                }
                return `$${rate} per second`;
            case 'char':
                return `$${rate} per 1K chars`;
            case 'compute':
                return `$${rate}/comp-s`;
            case 'video_tokens':
                return `$${rate}/M tokens`;
            default:
                return `$${rate}`;
        }
    };

    // Generate all models with dynamic pricing
    const models = MODEL_OPTIONS.map(model => {
        const category = extractCategoryFromLabel(model.label);
        const cleanName = model.label.replace(/ \([^)]+\)$/, '');

        return {
            id: model.value,
            name: cleanName,
            provider: model.provider,
            category: category,
            image: getModelImage(model.value, category),
            logo: logoMap[model.value] || '/images/logo.png',
            description: getModelDescription(model.value, category),
            price: getPricingType(model.value), // Dynamic pricing type
            context: getModelPrice(model.value) // Dynamic pricing amount from central DB
        };
    });

    // Filter models by category using dynamic filtering
    const recommendedModels = models.slice(0, 3);
    const textToTextModels = models.filter(model => model.category === 'Text');
    const textToImageModels = models.filter(model => model.category === 'Image');
    const textToVideoModels = models.filter(model => model.category === 'Video');
    const audioModels = models.filter(model => model.category === 'Audio');
    const audioToAudioModels = models.filter(model => model.category === 'Audio-to-Audio');
    const imageTo3DModels = models.filter(model => model.category === 'Image-to-3D');
    const imageToImageModels = models.filter(model => model.category === 'Image-to-Image');
    const imageToVideoModels = models.filter(model => model.category === 'Image-to-Video');
    const audioToTextModels = models.filter(model => model.category === 'Audio-to-Text');
    const videoToVideoModels = models.filter(model => model.category === 'Video-to-Video');

    // Get all unique categories
    const allCategories = Array.from(new Set(models.map(m => m.category)));
    const categories = ['All', ...allCategories];
    // Filter models by selected category
    const filteredModels = selectedCategory === 'All' ? models : models.filter(m => m.category === selectedCategory);

    // Helper to get capx tag for table view
    const getCapxTag = (category: string) => {
        return category === 'Text' ? 'capx_textmodels' : 'capx_ivmodels';
    };

    return (
        <section className="p-0 h-full min-h-0 bg-[#121214]">
            {/* Banner */}
            <div className="w-full h-[220px] md:h-[250px] overflow-hidden relative bg-[#142C96]">
                <img
                    src="/images/image 8.svg"
                    alt="AI4Everyone Banner"
                    className="w-full h-full object-cover object-center relative z-[1] hidden md:block"
                />
                <img
                    src="/images/Frame 43.png"
                    alt="AI4Everyone Mobile Banner"
                    className="w-full h-full object-cover object-center md:hidden block relative z-[1]"
                />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[120px] bg-gradient-to-t from-black/80 to-transparent z-[2]"></div>
            </div>

            {/* Header row */}
            <div className="flex flex-col items-start max-w-[1200px] md:w-[90%] w-full mx-auto md:mt-[-35px] relative z-[3] px-4 md:px-0 ">
                <div className="flex-1">
                    <h1 className="font-black text-[40px] text-white">Explore Models</h1>
                    <p className="text-sm md:text-base text-[#999999] text-left mb-4 w-full">Discover powerful AI models for every modality—text, image, video, audio, and beyond.</p>
                </div>
                <div className="flex items-center w-full">
                    <div className="flex gap-3">
                        <button
                            className={`border border-[#444] rounded-[10px] p-2 flex items-center justify-center text-[18px] transition-colors ${viewMode === 'card' ? 'bg-white text-[#181818]' : 'bg-transparent text-white'}`}
                            onClick={() => setViewMode('card')}
                            aria-label="Card View"
                        >
                            <LayoutGrid size={20} />
                        </button>
                        <button
                            className={`border border-[#444] rounded-[10px] p-2 flex items-center justify-center text-[18px] transition-colors ${viewMode === 'table' ? 'bg-white text-[#181818]' : 'bg-transparent text-white'}`}
                            onClick={() => setViewMode('table')}
                            aria-label="Table View"
                        >
                            <Table size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {viewMode === 'card' ? (
                <>
                    {/* Recommended */}
                    <section className="pt-5 pb-5">
                        <div className="flex flex-col items-start pt-[35px] max-w-[1200px] w-[90%] mx-auto relative z-[3]">
                            <h2 className="text-white text-[32px] font-bold text-left mb-2">RECOMMENDED MODELS</h2>
                            <p className="text-[15px] text-[#bbb] text-left mb-2">Models curated based on popularity and real-time usage across the platform.</p>
                        </div>
                        <div className="grid gap-6 max-w-[1200px] w-[90%] mx-auto grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
                            {recommendedModels.map(model => (
                                <Link to={`/playground?model=${encodeURIComponent(model.id)}`} key={model.id} className="no-underline text-inherit">
                                    <div className="rounded-[12px] overflow-hidden transition-colors bg-transparent hover:bg-[#232323] flex flex-col h-full">
                                        <div className="rounded-[10px] border border-[#333] relative h-[200px] overflow-hidden">
                                            <img src={model.image} alt={model.name} className="w-full h-full object-cover" />
                                            <img src={model.logo} alt={`${model.name} logo`} className="absolute right-2 bottom-2 w-10 h-10 object-contain" />
                                        </div>
                                        <div className="p-5 flex flex-col flex-grow">
                                            <h3 className="text-[20px] font-normal text-white mb-2">{model.name}</h3>
                                            <div className="flex gap-2 mb-3">
                                                <span className="text-[12px] px-2 py-1 rounded bg-[#333] text-[#bbb]">{model.provider}</span>
                                                <span className="text-[12px] px-2 py-1 rounded bg-[#333] text-[#bbb]">{model.category}</span>
                                            </div>
                                            <p className="text-[14px] text-[#999] mb-4 leading-[1.5]">{model.description}</p>
                                            <div className="flex justify-between items-center mt-auto">
                                                <span className="text-[#4CAF50] text-[14px] px-2 py-1 rounded bg-[rgba(76,175,80,0.1)]">{model.price}</span>
                                                <span className="text-[#2196F3] text-[14px] px-2 py-1 rounded bg-[rgba(33,150,243,0.1)]">{model.context}</span>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>

                    {/* Text-to-Text */}
                    <section className="">
                        <div className="flex flex-col items-start max-w-[1200px] w-[90%] mx-auto relative z-[3]">
                            <h2 className="text-white text-[32px] font-bold text-left mb-2">TEXT-TO-TEXT</h2>
                            <p className="text-[16px] text-[#bbb] text-left mb-2 max-w-[60%]">Prices shown are per 1 million tokens</p>
                        </div>
                        <div className="grid grid-flow-col auto-cols-[300px] gap-6 max-w-[1200px] w-[90%] mx-auto overflow-x-auto pb-5">
                            {textToTextModels.map(model => (
                                <Link to={`/playground?model=${encodeURIComponent(model.id)}`} key={model.id} className="no-underline text-inherit">
                                    <div className="rounded-[12px] overflow-hidden transition-colors bg-transparent hover:bg-[#232323] flex flex-col h-full">
                                        <div className="rounded-[10px] border border-[#333] relative h-[200px] overflow-hidden">
                                            <img src={model.image} alt={model.name} className="w-full h-full object-cover" />
                                            <img src={model.logo} alt={`${model.name} logo`} className="absolute right-2 bottom-2 w-10 h-10 object-contain" />
                                        </div>
                                        <div className="p-5 flex flex-col flex-grow">
                                            <h3 className="text-[20px] font-normal text-white mb-2">{model.name}</h3>
                                            <div className="flex gap-2 mb-3">
                                                <span className="text-[12px] px-2 py-1 rounded bg-[#333] text-[#bbb]">{model.provider}</span>
                                                <span className="text-[12px] px-2 py-1 rounded bg-[#333] text-[#bbb]">{model.category}</span>
                                            </div>
                                            <p className="text-[14px] text-[#999] mb-4 leading-[1.5]">{model.description}</p>
                                            <div className="flex justify-between items-center mt-auto">
                                                <span className="text-[#4CAF50] text-[14px] px-2 py-1 rounded bg-[rgba(76,175,80,0.1)]">{model.price}</span>
                                                <span className="text-[#2196F3] text-[14px] px-2 py-1 rounded bg-[rgba(33,150,243,0.1)]">{model.context}</span>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>

                    {/* Text-to-Image */}
                    <section className="">
                        <div className="flex flex-col items-start max-w-[1200px] w-[90%] mx-auto relative z-[3]">
                            <h2 className="text-white text-[32px] font-bold text-left mb-2">TEXT-TO-IMAGE</h2>
                            <p className="text-[16px] text-[#bbb] text-left mb-2">High-quality image generation models</p>
                        </div>
                        <div className="grid grid-flow-col auto-cols-[300px] gap-6 max-w-[1200px] w-[90%] mx-auto overflow-x-auto pb-5">
                            {textToImageModels.map(model => (
                                <Link to={`/playground?model=${encodeURIComponent(model.id)}`} key={model.id} className="no-underline text-inherit">
                                    <div className="rounded-[12px] overflow-hidden transition-colors bg-transparent hover:bg-[#232323] flex flex-col h-full">
                                        <div className="rounded-[10px] border border-[#333] relative h-[200px] overflow-hidden">
                                            <img src={model.image} alt={model.name} className="w-full h-full object-cover" />
                                            <img src={model.logo} alt={`${model.name} logo`} className="absolute right-2 bottom-2 w-10 h-10 object-contain" />
                                        </div>
                                        <div className="p-5 flex flex-col flex-grow">
                                            <h3 className="text-[20px] font-normal text-white mb-2">{model.name}</h3>
                                            <div className="flex gap-2 mb-3">
                                                <span className="text-[12px] px-2 py-1 rounded bg-[#333] text-[#bbb]">{model.provider}</span>
                                                <span className="text-[12px] px-2 py-1 rounded bg-[#333] text-[#bbb]">{model.category}</span>
                                            </div>
                                            <p className="text-[14px] text-[#999] mb-4 leading-[1.5]">{model.description}</p>
                                            <div className="flex justify-between items-center mt-auto">
                                                <span className="text-[#4CAF50] text-[14px] px-2 py-1 rounded bg-[rgba(76,175,80,0.1)]">{model.price}</span>
                                                <span className="text-[#2196F3] text-[14px] px-2 py-1 rounded bg-[rgba(33,150,243,0.1)]">{model.context}</span>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>

                    {/* Text-to-Video */}
                    <section className="">
                        <div className="flex flex-col items-start max-w-[1200px] w-[90%] mx-auto relative z-[3]">
                            <h2 className="text-white text-[32px] font-bold text-left mb-2">TEXT-TO-VIDEO</h2>
                            <p className="text-[16px] text-[#bbb] text-left mb-2">High-quality video generation models</p>
                        </div>
                        <div className="grid grid-flow-col auto-cols-[300px] gap-6 max-w-[1200px] w-[90%] mx-auto overflow-x-auto pb-5">
                            {textToVideoModels.map(model => (
                                <Link to={`/playground?model=${encodeURIComponent(model.id)}`} key={model.id} className="no-underline text-inherit">
                                    <div className="rounded-[12px] overflow-hidden transition-colors bg-transparent hover:bg-[#232323] flex flex-col h-full">
                                        <div className="rounded-[10px] border border-[#333] relative h-[200px] overflow-hidden">
                                            <img src={model.image} alt={model.name} className="w-full h-full object-cover" />
                                            <img src={model.logo} alt={`${model.name} logo`} className="absolute right-2 bottom-2 w-10 h-10 object-contain" />
                                        </div>
                                        <div className="p-5 flex flex-col flex-grow">
                                            <h3 className="text-[20px] font-normal text-white mb-2">{model.name}</h3>
                                            <div className="flex gap-2 mb-3">
                                                <span className="text-[12px] px-2 py-1 rounded bg-[#333] text-[#bbb]">{model.provider}</span>
                                                <span className="text-[12px] px-2 py-1 rounded bg-[#333] text-[#bbb]">{model.category}</span>
                                            </div>
                                            <p className="text-[14px] text-[#999] mb-4 leading-[1.5]">{model.description}</p>
                                            <div className="flex justify-between items-center mt-auto">
                                                <span className="text-[#4CAF50] text-[14px] px-2 py-1 rounded bg-[rgba(76,175,80,0.1)]">{model.price}</span>
                                                <span className="text-[#2196F3] text-[14px] px-2 py-1 rounded bg-[rgba(33,150,243,0.1)]">{model.context}</span>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>

                    {/* Text-to-Audio */}
                    <section className="">
                        <div className="flex flex-col items-start max-w-[1200px] w-[90%] mx-auto relative z-[3]">
                            <h2 className="text-white text-[32px] font-bold text-left mb-2">TEXT-TO-AUDIO</h2>
                            <p className="text-[16px] text-[#bbb] text-left mb-2">High-quality audio generation models</p>
                        </div>
                        <div className="grid grid-flow-col auto-cols-[300px] gap-6 max-w-[1200px] w-[90%] mx-auto overflow-x-auto pb-5">
                            {audioModels.map(model => (
                                <Link to={`/playground?model=${encodeURIComponent(model.id)}`} key={model.id} className="no-underline text-inherit">
                                    <div className="rounded-[12px] overflow-hidden transition-colors bg-transparent hover:bg-[#232323] flex flex-col h-full">
                                        <div className="rounded-[10px] border border-[#333] relative h-[200px] overflow-hidden">
                                            <img src={model.image} alt={model.name} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="p-5 flex flex-col flex-grow">
                                            <h3 className="text-[20px] font-normal text-white mb-2">{model.name}</h3>
                                            <div className="flex gap-2 mb-3">
                                                <span className="text-[12px] px-2 py-1 rounded bg-[#333] text-[#bbb]">{model.provider}</span>
                                                <span className="text-[12px] px-2 py-1 rounded bg-[#333] text-[#bbb]">{model.category}</span>
                                            </div>
                                            <p className="text-[14px] text-[#999] mb-4 leading-[1.5]">{model.description}</p>
                                            <div className="flex justify-between items-center mt-auto">
                                                <span className="text-[#4CAF50] text-[14px] px-2 py-1 rounded bg-[rgba(76,175,80,0.1)]">{model.price}</span>
                                                <span className="text-[#2196F3] text-[14px] px-2 py-1 rounded bg-[rgba(33,150,243,0.1)]">{model.context}</span>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>

                    {/* Audio-to-Audio */}
                    <section className="">
                        <div className="flex flex-col items-start max-w-[1200px] w-[90%] mx-auto relative z-[3]">
                            <h2 className="text-white text-[32px] font-bold text-left mb-2">AUDIO TO AUDIO MODELS</h2>
                            <p className="text-[16px] text-[#bbb] text-left mb-2">Advanced audio-to-audio generation and editing models</p>
                        </div>
                        <div className="grid grid-flow-col auto-cols-[300px] gap-6 max-w-[1200px] w-[90%] mx-auto overflow-x-auto pb-5">
                            {audioToAudioModels.map(model => (
                                <Link to={`/playground?model=${encodeURIComponent(model.id)}`} key={model.id} className="no-underline text-inherit">
                                    <div className="rounded-[12px] overflow-hidden transition-colors bg-transparent hover:bg-[#232323] flex flex-col h-full">
                                        <div className="rounded-[10px] border border-[#333] relative h-[200px] overflow-hidden">
                                            <img src={model.image} alt={model.name} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="p-5 flex flex-col flex-grow">
                                            <h3 className="text-[20px] font-normal text-white mb-2">{model.name}</h3>
                                            <div className="flex gap-2 mb-3">
                                                <span className="text-[12px] px-2 py-1 rounded bg-[#333] text-[#bbb]">{model.provider}</span>
                                                <span className="text-[12px] px-2 py-1 rounded bg-[#333] text-[#bbb]">{model.category}</span>
                                            </div>
                                            <p className="text-[14px] text-[#999] mb-4 leading-[1.5]">{model.description}</p>
                                            <div className="flex justify-between items-center mt-auto">
                                                <span className="text-[#4CAF50] text-[14px] px-2 py-1 rounded bg-[rgba(76,175,80,0.1)]">{model.price}</span>
                                                <span className="text-[#2196F3] text-[14px] px-2 py-1 rounded bg-[rgba(33,150,243,0.1)]">{model.context}</span>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>

                    {/* Image to 3D */}
                    <section className="">
                        <div className="flex flex-col items-start max-w-[1200px] w-[90%] mx-auto relative z-[3]">
                            <h2 className="text-white text-[32px] font-bold text-left mb-2">IMAGE TO 3D MODELS</h2>
                            <p className="text-[16px] text-[#bbb] text-left mb-2">Generate 3D models from images using advanced AI models</p>
                        </div>
                        <div className="grid grid-flow-col auto-cols-[300px] gap-6 max-w-[1200px] w-[90%] mx-auto overflow-x-auto pb-5">
                            {imageTo3DModels.map(model => (
                                <Link to={`/playground?model=${encodeURIComponent(model.id)}`} key={model.id} className="no-underline text-inherit">
                                    <div className="rounded-[12px] overflow-hidden transition-colors bg-transparent hover:bg-[#232323] flex flex-col h-full">
                                        <div className="rounded-[10px] border border-[#333] relative h-[200px] overflow-hidden">
                                            <img src={model.image} alt={model.name} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="p-5 flex flex-col flex-grow">
                                            <h3 className="text-[20px] font-normal text-white mb-2">{model.name}</h3>
                                            <div className="flex gap-2 mb-3">
                                                <span className="text-[12px] px-2 py-1 rounded bg-[#333] text-[#bbb]">{model.provider}</span>
                                                <span className="text-[12px] px-2 py-1 rounded bg-[#333] text-[#bbb]">{model.category}</span>
                                            </div>
                                            <p className="text-[14px] text-[#999] mb-4 leading-[1.5]">{model.description}</p>
                                            <div className="flex justify-between items-center mt-auto">
                                                <span className="text-[#4CAF50] text-[14px] px-2 py-1 rounded bg-[rgba(76,175,80,0.1)]">{model.price}</span>
                                                <span className="text-[#2196F3] text-[14px] px-2 py-1 rounded bg-[rgba(33,150,243,0.1)]">{model.context}</span>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>

                    {/* Image to Image */}
                    <section className="">
                        <div className="flex flex-col items-start max-w-[1200px] w-[90%] mx-auto relative z-[3]">
                            <h2 className="text-white text-[32px] font-bold text-left mb-2">IMAGE TO IMAGE MODELS</h2>
                            <p className="text-[16px] text-[#bbb] text-left mb-2">Advanced image-to-image editing and enhancement models</p>
                        </div>
                        <div className="grid grid-flow-col auto-cols-[300px] gap-6 max-w-[1200px] w-[90%] mx-auto overflow-x-auto pb-5">
                            {imageToImageModels.map(model => (
                                <Link to={`/playground?model=${encodeURIComponent(model.id)}`} key={model.id} className="no-underline text-inherit">
                                    <div className="rounded-[12px] overflow-hidden transition-colors bg-transparent hover:bg-[#232323] flex flex-col h-full">
                                        <div className="rounded-[10px] border border-[#333] relative h-[200px] overflow-hidden">
                                            <img src={model.image} alt={model.name} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="p-5 flex flex-col flex-grow">
                                            <h3 className="text-[20px] font-normal text-white mb-2">{model.name}</h3>
                                            <div className="flex gap-2 mb-3">
                                                <span className="text-[12px] px-2 py-1 rounded bg-[#333] text-[#bbb]">{model.provider}</span>
                                                <span className="text-[12px] px-2 py-1 rounded bg-[#333] text-[#bbb]">{model.category}</span>
                                            </div>
                                            <p className="text-[14px] text-[#999] mb-4 leading-[1.5]">{model.description}</p>
                                            <div className="flex justify-between items-center mt-auto">
                                                <span className="text-[#4CAF50] text-[14px] px-2 py-1 rounded bg-[rgba(76,175,80,0.1)]">{model.price}</span>
                                                <span className="text-[#2196F3] text-[14px] px-2 py-1 rounded bg-[rgba(33,150,243,0.1)]">{model.context}</span>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>

                    {/* Image to Video */}
                    <section className="">
                        <div className="flex flex-col items-start max-w-[1200px] w-[90%] mx-auto relative z-[3]">
                            <h2 className="text-white text-[32px] font-bold text-left mb-2">IMAGE TO VIDEO MODELS</h2>
                            <p className="text-[16px] text-[#bbb] text-left mb-2">Generate videos from images using advanced AI models</p>
                        </div>
                        <div className="grid grid-flow-col auto-cols-[300px] gap-6 max-w-[1200px] w-[90%] mx-auto overflow-x-auto pb-5">
                            {imageToVideoModels.map(model => (
                                <Link to={`/playground?model=${encodeURIComponent(model.id)}`} key={model.id} className="no-underline text-inherit">
                                    <div className="rounded-[12px] overflow-hidden transition-colors bg-transparent hover:bg-[#232323] flex flex-col h-full">
                                        <div className="rounded-[10px] border border-[#333] relative h-[200px] overflow-hidden">
                                            <img src={model.image} alt={model.name} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="p-5 flex flex-col flex-grow">
                                            <h3 className="text-[20px] font-normal text-white mb-2">{model.name}</h3>
                                            <div className="flex gap-2 mb-3">
                                                <span className="text-[12px] px-2 py-1 rounded bg-[#333] text-[#bbb]">{model.provider}</span>
                                                <span className="text-[12px] px-2 py-1 rounded bg-[#333] text-[#bbb]">{model.category}</span>
                                            </div>
                                            <p className="text-[14px] text-[#999] mb-4 leading-[1.5]">{model.description}</p>
                                            <div className="flex justify-between items-center mt-auto">
                                                <span className="text-[#4CAF50] text-[14px] px-2 py-1 rounded bg-[rgba(76,175,80,0.1)]">{model.price}</span>
                                                <span className="text-[#2196F3] text-[14px] px-2 py-1 rounded bg-[rgba(33,150,243,0.1)]">{model.context}</span>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>

                    {/* Audio to Text */}
                    <section className="">
                        <div className="flex flex-col items-start max-w-[1200px] w-[90%] mx-auto relative z-[3]">
                            <h2 className="text-white text-[32px] font-bold text-left mb-2">AUDIO TO TEXT MODELS</h2>
                            <p className="text-[16px] text-[#bbb] text-left mb-2">Convert audio to text using advanced speech-to-text models</p>
                        </div>
                        <div className="grid grid-flow-col auto-cols-[300px] gap-6 max-w-[1200px] w-[90%] mx-auto overflow-x-auto pb-5">
                            {audioToTextModels.map(model => (
                                <Link to={`/playground?model=${encodeURIComponent(model.id)}`} key={model.id} className="no-underline text-inherit">
                                    <div className="rounded-[12px] overflow-hidden transition-colors bg-transparent hover:bg-[#232323] flex flex-col h-full">
                                        <div className="rounded-[10px] border border-[#333] relative h-[200px] overflow-hidden">
                                            <img src={model.image} alt={model.name} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="p-5 flex flex-col flex-grow">
                                            <h3 className="text-[20px] font-normal text-white mb-2">{model.name}</h3>
                                            <div className="flex gap-2 mb-3">
                                                <span className="text-[12px] px-2 py-1 rounded bg-[#333] text-[#bbb]">{model.provider}</span>
                                                <span className="text-[12px] px-2 py-1 rounded bg-[#333] text-[#bbb]">{model.category}</span>
                                            </div>
                                            <p className="text-[14px] text-[#999] mb-4 leading-[1.5]">{model.description}</p>
                                            <div className="flex justify-between items-center mt-auto">
                                                <span className="text-[#4CAF50] text-[14px] px-2 py-1 rounded bg-[rgba(76,175,80,0.1)]">{model.price}</span>
                                                <span className="text-[#2196F3] text-[14px] px-2 py-1 rounded bg-[rgba(33,150,243,0.1)]">{model.context}</span>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </section>
                </>
            ) : (
                <>
                    {/* Category Tabs */}
                    <div className="flex flex-row items-start max-w-[1200px] w-[90%] mx-[5%] mb-6 relative z-10 gap-2 flex-wrap overflow-x-auto pb-[2px]">
                        {categories.map(cat => (
                            <button
                                key={cat}
                                className={`rounded-[20px] px-[18px] py-[7px] text-[15px] border border-[#444] transition-colors mb-[2px] ${selectedCategory === cat ? 'bg-white text-[#181818] border-white' : 'bg-transparent text-white hover:bg-[#232323]'}`}
                                onClick={() => setSelectedCategory(cat)}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                    <div className="w-[90%] mx-auto bg-[#181818] border border-[#444] rounded-[18px] overflow-x-auto shadow-[0_2px_16px_rgba(0,0,0,0.10)]">
                        <table className="w-full border-separate border-spacing-0 text-white font-['Titillium Web',Arial,sans-serif] text-[14px]">
                            <thead>
                                <tr className="bg-[#0e0e0e]">
                                    <th className="font-bold text-[17px] px-[15px] py-[10px] border-b border-[#333] text-left">Model</th>
                                    <th className="font-bold text-[17px] px-[15px] py-[10px] border-b border-[#333] text-left">Description</th>
                                    <th className="font-bold text-[17px] px-[15px] py-[10px] border-b border-[#333] text-left">Tag</th>
                                    <th className="font-bold text-[17px] px-[15px] py-[10px] border-b border-[#333] text-left">Price</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredModels.map(model => (
                                    <tr key={model.id} className="bg-[#0e0e0e] border-b border-[#333]">
                                        <td className="px-[15px] py-[10px] font-bold flex items-center gap-2"><img src={model.image} alt={model.name} className="w-8 h-8 rounded-[6px] object-cover mr-2" />{model.name}</td>
                                        <td className="px-[15px] py-[10px] max-w-[320px]">{model.description}</td>
                                        <td className="px-[15px] py-[10px]"><span className="inline-block bg-[#232323] text-white rounded-[16px] px-[14px] py-[4px] font-bold text-[13px] tracking-[0.2px] border border-[#333]">{getCapxTag(model.category)}</span></td>
                                        <td className="px-[15px] py-[10px] text-right align-middle whitespace-nowrap"><span className="text-[#4cff8f] block font-normal leading-[1.1]">{model.context.split(' ')[0]}</span><span className="text-[#888] block">{model.context.split(' ').slice(1).join(' ')}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )
            }

            <ViewDocumentationCard onClick={() => navigate('/docs')} />
        </section >
    );
});

export default ModelsPage;