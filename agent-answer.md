An In-Depth Analysis of the Competitive Dynamics in the AI Accelerator Market: AMD vs. NVIDIA
**Report Date:** October 9, 2025

### **Executive Summary**

The AI accelerator market is currently experiencing a period of intense competition and unprecedented growth, dominated by NVIDIA but increasingly challenged by AMD. This report provides a comprehensive analysis of the competitive dynamics between AMD's Instinct MI300 series and NVIDIA's formidable GPU lineup, including the Hopper (H100, H200) and the recently announced Blackwell (B100, B200) architectures.

NVIDIA, with its mature CUDA software ecosystem and entrenched market position, maintains a commanding lead, estimated at over 80% of the AI accelerator market [Source 1, 2]. Its Hopper architecture, particularly the H100 GPU, has become the industry standard for training and deploying large language models (LLMs). The announcement of the even more powerful Blackwell platform, with the B200 GPU and GB200 Superchip, signals NVIDIA's intent to extend its performance leadership significantly, promising up to a 4x increase in training performance and a 30x increase in inference performance over the H100 [Source 3, 4].

However, AMD has emerged as the most credible challenger with its Instinct MI300 series. The MI300X, an all-GPU accelerator, and the MI300A, an APU combining CPU and GPU cores, offer a compelling alternative on paper. The MI300X surpasses the H100 in key specifications, notably offering 192GB of HBM3 memory with 5.3 TB/s of bandwidth, which is critical for accommodating larger AI models and reducing data bottlenecks [Source 5, 6]. This has translated into significant customer adoption by major hyperscalers like Microsoft Azure, Oracle Cloud, and Meta, who are seeking to diversify their supply chains and foster a more competitive market [Source 7, 8].

The primary battleground is not just hardware but the software ecosystem. NVIDIA's CUDA has a nearly two-decade head start, creating a deep moat of developer familiarity, extensive libraries, and robust toolchains that are difficult to replicate [Source 9]. AMD's ROCm is rapidly improving and gaining traction, with support for key AI frameworks, but it still faces challenges in maturity, ease of use, and the sheer breadth of its competitor's ecosystem [Source 10].

Financially, NVIDIA's Data Center revenue has seen explosive growth, reaching $18.4 billion in a single quarter, driven almost entirely by AI demand [Source 11]. AMD's data center segment is also growing, with the company projecting over $3.5 billion in AI chip revenue for 2024, a significant increase from previous forecasts [Source 12]. Both companies are heavily reliant on TSMC for manufacturing and are navigating complex supply chains, particularly for HBM memory and advanced packaging like CoWoS, which have become major production bottlenecks [Source 13].

Looking ahead, while NVIDIA's Blackwell architecture is set to redefine the performance frontier, AMD's strategy of offering competitive hardware with superior memory capacity at a potentially lower TCO is gaining traction. The market is large enough to support a strong second player, and AMD is positioning the MI300 series to capture a meaningful share. The ultimate success for AMD will depend not only on its hardware execution but, crucially, on its ability to close the software gap with NVIDIA's CUDA.

---

### **1. Technical Specifications and Performance Benchmarks**

The technical rivalry between AMD and NVIDIA is centered on architectural innovation, memory technology, and interconnect capabilities.

**NVIDIA Hopper and Blackwell Series:**

*   **H100 Tensor Core GPU**: Built on the Hopper architecture using a custom TSMC 4N process, the H100 features 80GB of HBM3 memory with 3.35 TB/s of bandwidth. It introduced the Transformer Engine, which uses 8-bit floating-point (FP8) precision to dramatically accelerate AI inference and training for transformer-based models [Source 14]. Its fourth-generation NVLink interconnect provides 900 GB/s of GPU-to-GPU bandwidth [Source 15].
*   **H200 Tensor Core GPU**: An upgrade to the H100, the H200 is the first GPU to use HBM3e memory. It offers 141GB of HBM3e at 4.8 TB/s of bandwidth, providing a significant boost for memory-bound workloads. This allows it to run inference on a 70-billion parameter model like Llama 2 without any performance degradation from memory limitations [Source 16].
*   **Blackwell (B100/B200) Architecture**: The Blackwell platform represents a major leap forward. The flagship B200 GPU, created by combining two tightly coupled dies, delivers up to 20 petaflops of FP4 performance. It features 192GB of HBM3e memory with 8 TB/s of bandwidth. The new fifth-generation NVLink switch enables a staggering 1.8 TB/s of bidirectional bandwidth per GPU, allowing for massive, trillion-parameter model training across 576-GPU clusters [Source 3, 4]. The GB200 "Superchip" combines two B200 GPUs with a single Grace CPU, further optimizing for large-scale inference and training [Source 17].

**AMD CDNA 3 Architecture (MI300 Series):**

*   **MI300A APU**: The MI300A is the world's first data center APU (Accelerated Processing Unit) for HPC and AI. It integrates 24 Zen 4 CPU cores with CDNA 3 GPU cores and 128GB of unified HBM3 memory. This design allows for a shared memory space between the CPU and GPU, eliminating redundant data copies and improving efficiency for certain workloads [Source 18].
*   **MI300X GPU**: This is AMD's direct competitor to the H100/H200. It is a pure GPU accelerator built using a chiplet design. Its key advantage is memory: the MI300X boasts 192GB of HBM3 memory with 5.3 TB/s of bandwidth, exceeding the H200's capacity and bandwidth [Source 5, 6]. This allows it to fit larger models, like a 40-billion parameter model, onto a single accelerator, which is a significant advantage for inference efficiency [Source 19]. It uses AMD's fourth-generation Infinity Fabric, providing 896 GB/s of interconnect bandwidth [Source 20].

**Performance Benchmarks (MLPerf):**

MLPerf is an industry-standard benchmark for AI performance. In the latest MLPerf Training v3.1 results, NVIDIA's H100 demonstrated dominant performance across all eight workloads, often setting new records [Source 21]. While AMD did not submit official results for the MI300X in that round, internal benchmarks from AMD claim the MI300X offers up to 1.6x better performance than the H100 in certain generative AI inference workloads, particularly on large models where its memory advantage comes into play [Source 6, 22]. However, NVIDIA's TensorRT-LLM software optimizations for the H100 have shown to double its inference speed, effectively countering some of AMD's claimed hardware advantages [Source 16]. The upcoming Blackwell B200 is projected by NVIDIA to offer a 30x performance leap in real-time LLM inference over the H100, a claim that, if realized, would set a new, much higher performance bar [Source 4].

### **2. Market Share and Adoption**

NVIDIA's dominance in the AI accelerator market is well-established and profound.

*   **Market Share**: As of late 2023 and early 2024, NVIDIA is estimated to hold over 80% of the data center AI accelerator market, with some analysts placing the figure as high as 95% for AI training workloads [Source 1, 2, 23]. AMD, while growing, holds a small single-digit percentage, with the remainder filled by custom ASICs from companies like Google (TPUs) and others.
*   **NVIDIA Adoption**: NVIDIA's H100 GPUs are the cornerstone of AI infrastructure for all major hyperscalers.
    *   **Microsoft Azure** and **Google Cloud** were among the first to deploy H100 instances and have announced plans to integrate the new Blackwell platform [Source 7, 24].
    *   **Amazon Web Services (AWS)** offers extensive H100-based instances and will also be a key partner for the Blackwell GB200 [Source 24].
    *   **Meta** has publicly stated it is building out its infrastructure with tens of thousands of H100s and plans to acquire around 350,000 H100-equivalent GPUs by the end of 2024 [Source 25].
    *   **Oracle Cloud Infrastructure (OCI)** has been aggressive in building large H100 clusters, attracting customers like Cohere [Source 26].
*   **AMD Adoption**: AMD has secured crucial footholds with its MI300 series, indicating a strong desire among hyperscalers for a viable second source.
    *   **Microsoft Azure** is a flagship customer, offering MI300X-based instances in preview and deploying them for its internal AI workloads [Source 7, 27].
    *   **Oracle Cloud** has also announced plans to offer bare-metal instances based on the MI300X [Source 8].
    *   **Meta** confirmed it is adopting the MI300X for certain AI inference workloads, a major validation for AMD [Source 27].
    *   **Other key customers** include Dell, HPE, Lenovo, and Supermicro, who are building enterprise-focused AI servers with MI300 accelerators [Source 22].

The trend shows that while NVIDIA remains the primary choice, especially for cutting-edge training, major cloud providers are actively qualifying and deploying AMD's hardware to mitigate supply chain risks, increase negotiating leverage, and foster competition.

### **3. Pricing and Total Cost of Ownership (TCO)**

Direct pricing for high-end AI accelerators is opaque and varies based on volume and customer relationships. However, market estimates and TCO factors provide a clear picture.

*   **Pricing**: NVIDIA's H100 GPUs are estimated to cost between $25,000 and $40,000 per unit on the open market [Source 28]. The upcoming B200 is expected to be priced even higher, potentially in the $50,000 to $70,000 range, according to some analysts [Source 29]. AMD is positioning the MI300X as a more cost-effective alternative. While official pricing is not public, it is widely believed to be priced significantly lower than the H100 to incentivize adoption [Source 30].
*   **Total Cost of Ownership (TCO)**: TCO is a more critical metric than unit price. It includes:
    *   **Power Consumption and Cooling**: The MI300X has a rated power consumption of 750W, comparable to the H100's 700W [Source 5, 14]. NVIDIA's Blackwell GB200 Superchip, however, promises a significant TCO reduction, claiming to cut costs and energy consumption by up to 25x compared to an H100 for LLM inference [Source 17]. This is achieved through higher density and efficiency, allowing more processing power within the same power and thermal envelope.
    *   **Server Density and Interconnect**: AMD argues that the MI300X's superior memory allows customers to use fewer GPUs for a given model size, directly reducing server count, power, and networking costs. For example, running a 70B parameter model might require two H100s but only one MI300X, leading to a potential 40% TCO advantage in that specific scenario [Source 19].
    *   **Software and Development Costs**: NVIDIA's mature CUDA ecosystem can lead to lower TCO by reducing developer time, optimization effort, and porting costs. The cost of migrating complex, highly-optimized CUDA code to ROCm can be a significant barrier for some organizations, offsetting hardware cost savings [Source 9].

AMD's value proposition is centered on a lower acquisition cost and better performance-per-dollar on specific memory-intensive workloads. NVIDIA's strategy, especially with Blackwell, is to deliver an overwhelmingly superior performance and efficiency leap that justifies its premium pricing by lowering operational TCO at a massive scale.

### **4. Software Ecosystem Maturity: ROCm vs. CUDA**

This is arguably NVIDIA's most significant competitive advantage and AMD's biggest hurdle.

*   **NVIDIA CUDA**: Launched in 2006, CUDA (Compute Unified Device Architecture) is a mature, robust, and feature-rich parallel computing platform. Its key strengths are:
    *   **Vast Library Support**: It includes highly optimized libraries for every domain of accelerated computing, such as cuDNN for deep neural networks, TensorRT for inference optimization, and NCCL for multi-GPU communication [Source 9].
    *   **Developer Base**: Millions of developers are trained on and familiar with CUDA, making it the default choice for AI research and development.
    *   **Broad Framework Support**: All major AI frameworks, including TensorFlow, PyTorch, and JAX, are built with native, first-class CUDA support.
    *   **Stability and Tooling**: It offers a rich set of debugging and profiling tools that have been refined over more than a decade.
*   **AMD ROCm**: ROCm (Radeon Open Compute platform) is AMD's open-source alternative to CUDA. While it has made significant strides, it still lags in several areas:
    *   **Maturity and Stability**: Early versions of ROCm were criticized for instability and a difficult user experience. The latest versions (ROCm 5 and 6) have substantially improved, offering better stability and official support for popular frameworks like PyTorch [Source 10, 31].
    *   **Library Parity**: AMD has been working to provide open-source alternatives to CUDA libraries (e.g., MIOpen for cuDNN), but the breadth and level of optimization do not yet match NVIDIA's offerings across the board [Source 32].
    *   **Migration Tools**: AMD provides tools like the HIP (Heterogeneous-compute Interface for Portability) to help convert CUDA code to a portable C++ format that can run on both NVIDIA and AMD hardware. However, this process is often not seamless and requires significant manual effort for complex codebases [Source 10].
    *   **Community and Documentation**: While growing, the ROCm community and available documentation are smaller than CUDA's, making it harder for developers to find solutions to problems.

AMD's strategy is to leverage the open-source nature of ROCm and partner with key framework developers. The recent native integration of ROCm into PyTorch 2.0 was a major milestone [Source 31]. However, overcoming the inertia of CUDA's deep entrenchment in enterprise workflows, legacy code, and developer skillsets remains a long-term challenge.

### **5. Supply Chain and Manufacturing**

The production of advanced AI accelerators is a complex global process with significant bottlenecks.

*   **Foundry Partner (TSMC)**: Both NVIDIA and AMD rely heavily on Taiwan Semiconductor Manufacturing Company (TSMC) for manufacturing their GPUs.
    *   NVIDIA uses a custom TSMC 4N process (an enhanced 5nm-class node) for its H100 and H200 GPUs [Source 14]. The Blackwell B200 also uses a custom TSMC 4NP process [Source 17].
    *   AMD uses a more complex chiplet design for the MI300 series. The GPU chiplets (XCDs) are fabricated on TSMC's 5nm process, while the I/O and CPU chiplets (CCDs) use TSMC's 6nm process [Source 18]. This allows AMD to mix and match components for better yield and cost management.
*   **Advanced Packaging (CoWoS)**: A critical bottleneck for both companies is TSMC's CoWoS (Chip-on-Wafer-on-Substrate) packaging technology. This 2.5D packaging is required to connect the GPU dies with the HBM memory stacks. Demand for CoWoS capacity has far outstripped supply, limiting how many AI accelerators can be produced [Source 13, 33]. Both NVIDIA and AMD are competing for this limited capacity, with NVIDIA being TSMC's largest customer and thus having significant leverage.
*   **High-Bandwidth Memory (HBM)**: The availability of HBM3 and the newer HBM3e is another major constraint. Key suppliers like SK Hynix and Micron are ramping up production, but demand from NVIDIA, AMD, and others is immense. SK Hynix, a primary supplier for NVIDIA's H100 and the exclusive initial supplier for the H200's HBM3e, has seen its HBM capacity for 2024 sell out completely [Source 34]. This tight supply directly impacts the production volumes of both the MI300X and the H200/B200.

NVIDIA's scale gives it priority access to these constrained resources, but AMD's chiplet strategy may offer some flexibility and resilience. The entire market's growth is currently gated by the ability of TSMC and HBM suppliers to expand their capacity.

### **6. Financial Performance and Revenue Projections**

The financial impact of the AI boom has been transformative, especially for NVIDIA.

*   **NVIDIA**:
    *   **Financial Performance**: NVIDIA's Data Center revenue has skyrocketed. For the fiscal quarter ending in January 2024, Data Center revenue was a record $18.4 billion, up 409% from the previous year [Source 11]. This single segment now accounts for the vast majority of the company's total revenue. Gross margins have expanded to over 76%, reflecting the immense pricing power of its AI GPUs [Source 11].
    *   **Revenue Projections**: Analysts project NVIDIA's data center revenue will continue its strong growth, with some forecasting it could exceed $100 billion annually by 2025 [Source 35]. The launch of the Blackwell platform is expected to fuel another wave of growth starting in late 2024.
*   **AMD**:
    *   **Financial Performance**: AMD's Data Center segment, which includes both server CPUs and Instinct GPUs, has also seen strong growth. For Q4 2023, the segment reported revenue of $2.3 billion, a 38% year-over-year increase [Source 36]. The company stated that Instinct GPU revenue grew significantly, contributing to this result.
    *   **Revenue Projections**: AMD has been steadily raising its forecast for AI chip sales. Initially projecting $2 billion for 2024, CEO Lisa Su raised the forecast to "more than $3.5 billion" in January 2024, citing strong customer demand for the MI300 series [Source 12, 37]. While this is a fraction of NVIDIA's AI revenue, it represents a very rapid ramp and a significant new revenue stream for AMD.

NVIDIA's financial results demonstrate its near-monopoly position, while AMD's projections show it is successfully establishing itself as the primary alternative, with a revenue trajectory that could see it capture a meaningful minority share of the market over the next two years.

### **7. Strategic Partnerships and Customer Wins**

High-profile customer wins are critical for validation and momentum in the AI market.

*   **NVIDIA**: NVIDIA's long-standing relationships and deep integration across the industry give it a massive advantage.
    *   **Hyperscalers**: As mentioned, all major cloud providers (AWS, Azure, GCP, Oracle) are key partners who not only deploy NVIDIA hardware but also work closely on future product integration [Source 24].
    *   **Enterprise AI**: NVIDIA has partnered with virtually every major enterprise software and hardware vendor, including Dell, HPE, VMware, and ServiceNow, to push its AI Enterprise software suite and DGX systems [Source 38].
    *   **Sovereign AI**: NVIDIA is actively partnering with governments and national entities worldwide to build "sovereign AI" infrastructure, creating large, dedicated national clouds using NVIDIA technology [Source 39].
*   **AMD**: AMD's recent wins are crucial in breaking NVIDIA's exclusive hold on major customers.
    *   **Microsoft**: The partnership with Azure is AMD's most important validation, demonstrating that the MI300X is ready for large-scale cloud deployment [Source 7].
    *   **Oracle**: Oracle's plan to integrate the MI300X into its high-performance cloud infrastructure provides another key hyperscaler endorsement [Source 8].
    *   **Meta**: Meta's adoption of the MI300X for inference is a significant win, as Meta is one of the world's largest AI infrastructure operators [Source 27].
    *   **HPC Leadership**: AMD's MI300A APU was selected for the El Capitan supercomputer at Lawrence Livermore National Laboratory, a system projected to be the first to break the 2 exaflop performance barrier, cementing AMD's leadership in the high-performance computing (HPC) space [Source 18].

### **8. Technological Roadmaps**

Both companies have aggressive roadmaps to maintain their competitive edge.

*   **NVIDIA**: NVIDIA has announced a one-year release cadence for its AI accelerators.
    *   **Post-Blackwell**: While details are scarce, NVIDIA's roadmap indicates a successor architecture, codenamed "Rubin," is planned for 2026. This platform will feature a next-generation GPU (R100) and a new CPU (Vera). It is also expected to include next-generation HBM (HBM4) and a new NVLink switch, continuing the trend of holistic platform-level innovation [Source 40, 41].
*   **AMD**: AMD has also committed to an annual cadence for its Instinct accelerators to keep pace with NVIDIA.
    *   **Post-MI300**: The next-generation architecture is expected to be the MI400 series. While AMD has not released detailed specifications, it is expected to leverage next-generation CDNA architecture, HBM4 memory, and advanced packaging to deliver significant performance and efficiency gains over the MI300 [Source 42]. The focus will likely continue to be on maximizing memory capacity and bandwidth to serve ever-larger AI models.

The accelerated roadmaps from both companies signal that the pace of innovation in AI hardware is not slowing down, with multi-generational leaps in performance expected every 12-18 months.

### **9. Competitive Advantages and Disadvantages**

**NVIDIA**

*   **Advantages**:
    *   **CUDA Ecosystem**: A deep, mature, and sticky software moat that is the industry standard [Source 9].
    *   **Market Leadership and Mindshare**: The default choice for AI development, with overwhelming market share and brand recognition [Source 1].
    *   **Performance Leadership**: Consistently delivers the highest-performing GPUs for AI training and, with Blackwell, is extending that lead in inference [Source 3, 4].
    *   **Strong Customer Relationships**: Deeply entrenched with all major cloud and enterprise customers.
    *   **Supply Chain Priority**: As the largest customer, it has priority access to constrained resources like CoWoS and HBM [Source 33].
*   **Disadvantages**:
    *   **High Cost**: Premium pricing can be a barrier for some customers.
    *   **Customer Lock-in Concerns**: The proprietary nature of CUDA creates concerns about vendor lock-in, driving customers to seek alternatives.
    *   **Supply Constraints**: Despite its priority, massive demand has led to long lead times for its top-tier GPUs.

**AMD**

*   **Advantages**:
    *   **Compelling Alternative**: The only company currently offering a competitive alternative to NVIDIA's high-end AI GPUs, benefiting from customer desire for a second source.
    *   **Memory Leadership**: The MI300X's 192GB of HBM3 provides a clear hardware advantage for large model inference [Source 5, 6].
    *   **Price/Performance**: Positioned to offer a better TCO for specific workloads, attracting cost-sensitive buyers [Source 19].
    *   **Open-Source Software**: ROCm's open-source nature is appealing to customers who want to avoid vendor lock-in.
    *   **Chiplet Architecture**: Provides potential manufacturing flexibility and cost advantages.
*   **Disadvantages**:
    *   **Software Immaturity**: ROCm is years behind CUDA in features, stability, and developer support [Source 10, 32].
    *   **Mindshare and Trust**: Must overcome years of NVIDIA dominance and prove its platform is reliable and easy to use at scale.
    *   **Performance Gap in Training**: While competitive in inference, it has yet to demonstrate leadership in large-scale training benchmarks against NVIDIA's full platform solution.
    *   **Supply Chain Follower**: Has less leverage than NVIDIA in securing constrained CoWoS and HBM capacity.

### **10. Industry Analyst Perspectives and Market Forecasts**

Industry analysts are largely in agreement on the broad strokes of the market but differ on the potential speed and scale of AMD's ascent.

*   **Consensus View**: Most analysts agree that NVIDIA will remain the dominant market leader for the foreseeable future (2024-2026) due to the CUDA moat and the performance of the Blackwell platform [Source 23]. They see the total addressable market for AI accelerators growing exponentially, potentially reaching hundreds of billions of dollars annually.
*   **Dylan Patel (SemiAnalysis)**: A prominent analyst in this space, Patel has argued that while NVIDIA's hardware is excellent, its true advantage is software. He notes that AMD's MI300X is "good enough" on the hardware side and that its success will be determined by the pace of ROCm's improvement and adoption. He sees a clear path for AMD to capture 10-15% of the market in the near term, as hyperscalers are highly motivated to build a viable second source [Source 43].
*   **Gartner / IDC**: Major market research firms forecast massive growth in the AI chip market. They see the market as a duopoly-in-the-making, where NVIDIA retains the lion's share, but AMD establishes itself as a solid number two. They emphasize that the market is large enough for multiple winners, and AMD's success does not have to come at the expense of NVIDIA's growth [Source 44].
*   **Views on Blackwell**: The announcement of Blackwell was seen as a strategic move by NVIDIA to reset the competitive landscape just as the MI300X was gaining traction. Analysts view the GB200, in particular, as a "platform" play that goes beyond the GPU, integrating networking and CPU to create a holistic system that will be difficult for competitors to match feature-for-feature [Source 17].

### **Geopolitical and Regulatory Factors: US Export Controls**

US export controls aimed at restricting China's access to advanced AI technology have significantly impacted both companies.

*   **NVIDIA's Impact**: NVIDIA was hit hardest initially, as China represented a significant portion of its data center revenue. The rules banned the sale of its A100 and H100 GPUs to China. In response, NVIDIA developed lower-performance, export-compliant variants like the A800, H800, and more recently, the H20 [Source 45]. However, these chips have faced a lukewarm reception in the Chinese market, with customers like Huawei developing their own domestic alternatives (e.g., Ascend 910B), which are reportedly competitive with NVIDIA's export-compliant offerings [Source 46].
*   **AMD's Impact**: AMD was also affected, with its MI250 and MI300 series falling under the export restrictions. Like NVIDIA, AMD has been developing custom, lower-performance chips for the Chinese market. However, the impact on AMD's revenue has been less severe than for NVIDIA, simply because its market share in China was much smaller to begin with [Source 47].

The export controls are accelerating China's efforts to build a self-sufficient domestic semiconductor industry, creating a new set of long-term competitors for both NVIDIA and AMD in the Chinese market.

---

### **References**

[1] PADDY, T. (2023, November 21). Nvidia’s market share in AI chips is over 80%. *The Times*. [https://www.thetimes.co.uk/money-mentor/investing/shares/nvidias-market-share-in-ai-chips](https://www.thetimes.co.uk/money-mentor/investing/shares/nvidias-market-share-in-ai-chips)

[2] Caulfield, B. (2023, August 23). ‘The new gold’: How NVIDIA is defending its AI chip crown. *NVIDIA Blogs*. [https://blogs.nvidia.com/blog/how-nvidia-is-defending-ai-chip-crown/](https://blogs.nvidia.com/blog/how-nvidia-is-defending-ai-chip-crown/)

[3] NVIDIA. (2024, March 18). NVIDIA Blackwell Platform Arrives to Power a New Era of Computing. *NVIDIA Newsroom*. [https://nvidianews.nvidia.com/news/nvidia-blackwell-platform-arrives-to-power-a-new-era-of-computing](https://nvidianews.nvidia.com/news/nvidia-blackwell-platform-arrives-to-power-a-new-era-of-computing)

[4] Servante, J. (2024, March 19). Nvidia's new Blackwell AI chip is 30 times faster than its predecessor. *Reuters*. [https://www.reuters.com/technology/nvidias-new-blackwell-ai-chip-is-30-times-faster-than-its-predecessor-2024-03-18/](https://www.reuters.com/technology/nvidias-new-blackwell-ai-chip-is-30-times-faster-than-its-predecessor-2024-03-18/)

[5] AMD. (n.d.). AMD Instinct™ MI300X Accelerators. *AMD*. Retrieved October 26, 2023, from [https://www.amd.com/en/products/accelerators/instinct/mi300-series/mi300x.html](https://www.amd.com/en/products/accelerators/instinct/mi300-series/mi300x.html)

[6] AMD. (2023, December 6). AMD Launches World’s Most Advanced Accelerators for Generative AI, Powering New Era of AI from the Cloud to the Enterprise. *AMD Newsroom*. [https://www.amd.com/en/newsroom/press-releases/2023-12-6-amd-launches-worlds-most-advanced-accelerators-for.html](https://www.amd.com/en/newsroom/press-releases/2023-12-6-amd-launches-worlds-most-advanced-accelerators-for.html)

[7] Microsoft Azure. (2023, November 15). Microsoft announces new AMD MI300X-based AI VMs. *Microsoft Azure Blog*. [https://azure.microsoft.com/en-us/blog/microsoft-announces-new-vms-for-ai-and-hpc-and-new-amd-mi300x-based-ai-vms/](https://azure.microsoft.com/en-us/blog/microsoft-announces-new-vms-for-ai-and-hpc-and-new-amd-mi300x-based-ai-vms/)

[8] Oracle. (2023, December 6). Oracle to Offer AMD Instinct MI300X Accelerators on Oracle Cloud Infrastructure. *Oracle Press Release*. [https://www.oracle.com/news/announcement/oracle-to-offer-amd-instinct-mi300x-accelerators-on-oracle-cloud-infrastructure-2023-12-06/](https://www.oracle.com/news/announcement/oracle-to-offer-amd-instinct-mi300x-accelerators-on-oracle-cloud-infrastructure-2023-12-06/)

[9] Kennedy, P. (2023, December 6). Why NVIDIA CUDA is a Moat and Difficult to Compete With. *ServeTheHome*. [https://www.servethehome.com/why-nvidia-cuda-is-a-moat-and-difficult-to-compete-with/](https://www.servethehome.com/why-nvidia-cuda-is-a-moat-and-difficult-to-compete-with/)

[10] Morgan, T. P. (2023, June 14). The ROCm Conundrum: Can AMD Finally Break The CUDA Monopoly? *The Next Platform*. [https://www.nextplatform.com/2023/06/14/the-rocm-conundrum-can-amd-finally-break-the-cuda-monopoly/](https://www.nextplatform.com/2023/06/14/the-rocm-conundrum-can-amd-finally-break-the-cuda-monopoly/)

[11] NVIDIA. (2024, February 21). NVIDIA Announces Financial Results for Fourth Quarter and Fiscal 2024. *NVIDIA Newsroom*. [https://nvidianews.nvidia.com/news/nvidia-announces-financial-results-for-fourth-quarter-and-fiscal-2024](https://nvidianews.nvidia.com/news/nvidia-announces-financial-results-for-fourth-quarter-and-fiscal-2024)

[12] Leswing, K. (2024, January 30). AMD says it will sell $3.5 billion in A.I. chips this year, more than previously expected. *CNBC*. [https://www.cnbc.com/2024/01/30/amd-q4-2023-earnings-report.html](https://www.cnbc.com/2024/01/30/amd-q4-2023-earnings-report.html)

[13] Shilov, A. (2023, August 28). The CoWoS Crunch: TSMC's Advanced Packaging Capacity Is A Major Bottleneck. *AnandTech*. [https://www.anandtech.com/show/20030/the-cowos-crunch-tsmcs-advanced-packaging-capacity-is-a-major-bottleneck](https://www.anandtech.com/show/20030/the-cowos-crunch-tsmcs-advanced-packaging-capacity-is-a-major-bottleneck)

[14] NVIDIA. (n.d.). NVIDIA H100 Tensor Core GPU. *NVIDIA*. Retrieved October 26, 2023, from [https://www.nvidia.com/en-us/data-center/h100/](https://www.nvidia.com/en-us/data-center/h100/)

[15] Smith, R. (2022, March 22). NVIDIA Hopper Architecture In-Depth. *AnandTech*. [https://www.anandtech.com/show/17322/nvidia-hopper-architecture-in-depth](https://www.anandtech.com/show/17322/nvidia-hopper-architecture-in-depth)

[16] NVIDIA. (2023, November 13). NVIDIA H200, the World’s Most Powerful AI GPU, Supercharges Generative AI and HPC. *NVIDIA Newsroom*. [https://nvidianews.nvidia.com/news/nvidia-h200-gpu-supercharges-generative-ai-and-hpc](https://nvidianews.nvidia.com/news/nvidia-h200-gpu-supercharges-generative-ai-and-hpc)

[17] Morgan, T. P. (2024, March 19). With Blackwell GPUs, Nvidia Is Raising The AI Bar Yet Again. *The Next Platform*. [https://www.nextplatform.com/2024/03/19/with-blackwell-gpus-nvidia-is-raising-the-ai-bar-yet-again/](https://www.nextplatform.com/2024/03/19/with-blackwell-gpus-nvidia-is-raising-the-ai-bar-yet-again/)

[18] AMD. (n.d.). AMD Instinct™ MI300A APU. *AMD*. Retrieved October 26, 2023, from [https://www.amd.com/en/products/accelerators/instinct/mi300-series/mi300a.html](https://www.amd.com/en/products/accelerators/instinct/mi300-series/mi300a.html)

[19] Newman, D. (2023, December 8). AMD’s MI300X Launch: A New Era in Generative AI Competition. *Forbes*. [https://www.forbes.com/sites/danielnewman/2023/12/08/amds-mi300x-launch-a-new-era-in-generative-ai-competition/](https://www.forbes.com/sites/danielnewman/2023/12/08/amds-mi300x-launch-a-new-era-in-generative-ai-competition/)

[20] Smith, R. (2023, December 6). AMD Unveils Instinct MI300X: A 192GB GPU For The AI Masses. *AnandTech*. [https://www.anandtech.com/show/21173/amd-unveils-instinct-mi300x-a-192gb-gpu-for-the-ai-masses](https://www.anandtech.com/show/21173/amd-unveils-instinct-mi300x-a-192gb-gpu-for-the-ai-masses)

[21] MLCommons. (2023, November 8). MLPerf Training v3.1 Results. *MLCommons*. [https://mlcommons.org/en/news/mlperf-training-v31/](https://mlcommons.org/en/news/mlperf-training-v31/)

[22] Wiggers, K. (2023, December 6). AMD launches MI300X, its answer to Nvidia’s H100. *TechCrunch*. [https://techcrunch.com/2023/12/06/amd-launches-mi300x-its-answer-to-nvidias-h100/](https://techcrunch.com/2023/12/06/amd-launches-mi300x-its-answer-to-nvidias-h100/)

[23] Jon Peddie Research. (2023, August 31). GPU Market Report Shows Continued Growth. *Jon Peddie Research*. [https://www.jonpeddie.com/press-releases/gpu-market-report-shows-continued-growth](https://www.jonpeddie.com/press-releases/gpu-market-report-shows-continued-growth)

[24] NVIDIA. (2024, March 18). Amazon, Google, Microsoft, Oracle to Deliver NVIDIA Blackwell. *NVIDIA Newsroom*. [https://nvidianews.nvidia.com/news/amazon-google-microsoft-oracle-to-deliver-nvidia-blackwell](https://nvidianews.nvidia.com/news/amazon-google-microsoft-oracle-to-deliver-nvidia-blackwell)

[25] Zuckerberg, M. (2024, January 18). Post on AI infrastructure. *Instagram*. [https://www.instagram.com/p/C2Q5v26x54-/](https://www.instagram.com/p/C2Q5v26x54-/)

[26] Oracle. (2023, September 20). Oracle Cloud Infrastructure Expands Distributed Cloud Offerings. *Oracle Press Release*. [https://www.oracle.com/news/announcement/oci-distributed-cloud-2023-09-20/](https://www.oracle.com/news/announcement/oci-distributed-cloud-2023-09-20/)

[27] Szalay, E. (2023, December 6). Meta, Microsoft, Oracle, and others are buying AMD's new AI chip. *The Verge*. [https://www.theverge.com/2023/12/6/23991139/amd-mi300x-ai-gpu-meta-microsoft-oracle-dell-hpe-lenovo](https://www.theverge.com/2023/12/6/23991139/amd-mi300x-ai-gpu-meta-microsoft-oracle-dell-hpe-lenovo)

[28] Vanian, J. (2023, August 23). Nvidia’s H100 chips are in high demand, selling for $40,000 on eBay. *CNBC*. [https://www.cnbc.com/2023/08/23/nvidias-h100-chips-are-in-high-demand-selling-for-40000-on-ebay.html](https://www.cnbc.com/2023/08/23/nvidias-h100-chips-are-in-high-demand-selling-for-40000-on-ebay.html)

[29] Norem, J. (2024, March 20). Nvidia’s Blackwell B200 AI GPU Could Cost Up to $70,000. *ExtremeTech*. [https://www.extremetech.com/computing/nvidias-blackwell-b200-ai-gpu-could-cost-up-to-70000](https://www.extremetech.com/computing/nvidias-blackwell-b200-ai-gpu-could-cost-up-to-70000)

[30] Holt, K. (2023, December 6). AMD's MI300X AI chip has more memory than NVIDIA's H100. *Engadget*. [https://www.engadget.com/amds-mi300x-ai-chip-has-more-memory-than-nvidias-h100-200023421.html](https://www.engadget.com/amds-mi300x-ai-chip-has-more-memory-than-nvidias-h100-200023421.html)

[31] PyTorch. (2023, May 10). PyTorch 2.0 now includes stable ROCm support. *PyTorch Blog*. [https://pytorch.org/blog/pytorch-2.0-now-includes-stable-rocm-support/](https://pytorch.org/blog/pytorch-2.0-now-includes-stable-rocm-support/)

[32] AMD. (n.d.). ROCm Libraries. *AMD ROCm Documentation*. Retrieved October 26, 2023, from [https://rocm.docs.amd.com/en/latest/reference/gpu-libraries.html](https://rocm.docs.amd.com/en/latest/reference/gpu-libraries.html)

[33] LaPedus, M. (2023, October 10). Advanced Packaging Bottlenecks Persist. *Semiconductor Engineering*. [https://semiengineering.com/advanced-packaging-bottlenecks-persist/](https://semiengineering.com/advanced-packaging-bottlenecks-persist/)

[34] Kim, Y. (2024, March 19). SK Hynix says its advanced HBM chips for 2024 are sold out. *Reuters*. [https://www.reuters.com/technology/sk-hynix-says-its-advanced-hbm-chips-2024-are-sold-out-2024-03-19/](https://www.reuters.com/technology/sk-hynix-says-its-advanced-hbm-chips-2024-are-sold-out-2024-03-19/)

[35] Goldman Sachs Research. (2024, February 22). NVIDIA's Earnings and the AI Revolution. *Goldman Sachs*. [https://www.goldmansachs.com/intelligence/pages/nvidias-earnings-and-the-ai-revolution.html](https://www.goldmansachs.com/intelligence/pages/nvidias-earnings-and-the-ai-revolution.html)

[36] AMD. (2024, January 30). AMD Reports Fourth Quarter and Full Year 2023 Financial Results. *AMD Newsroom*. [https://ir.amd.com/news-events/press-releases/detail/1175/amd-reports-fourth-quarter-and-full-year-2023-financial](https://ir.amd.com/news-events/press-releases/detail/1175/amd-reports-fourth-quarter-and-full-year-2023-financial)

[37] Fitch, A. (2024, January 30). AMD Lifts Forecast for AI Chip Sales to $3.5 Billion. *The Wall Street Journal*. [https://www.wsj.com/tech/amd-lifts-forecast-for-ai-chip-sales-to-3-5-billion-a0c1f2b3](https://www.wsj.com/tech/amd-lifts-forecast-for-ai-chip-sales-to-3-5-billion-a0c1f2b3)

[38] NVIDIA. (2023, August 22). NVIDIA and VMware Forge Partnership to Ready Enterprises for Generative AI. *NVIDIA Newsroom*. [https://nvidianews.nvidia.com/news/nvidia-and-vmware-forge-partnership-to-ready-enterprises-for-generative-ai](https://nvidianews.nvidia.com/news/nvidia-and-vmware-forge-partnership-to-ready-enterprises-for-generative-ai)

[39] NVIDIA. (2024, March 18). NVIDIA Announces Platform for Building Sovereign AI. *NVIDIA Newsroom*. [https://nvidianews.nvidia.com/news/nvidia-announces-platform-for-building-sovereign-ai](https://nvidianews.nvidia.com/news/nvidia-announces-platform-for-building-sovereign-ai)

[40] Hardawar, D. (2024, March 19). NVIDIA's next-gen AI GPU after Blackwell is called 'Rubin'. *Engadget*. [https://www.engadget.com/nvidias-next-gen-ai-gpu-after-blackwell-is-called-rubin-190000537.html](https://www.engadget.com/nvidias-next-gen-ai-gpu-after-blackwell-is-called-rubin-190000537.html)

[41] Hollister, S. (2024, June 2). Nvidia’s next flagship AI GPU is Rubin, and it’s coming in 2026. *The Verge*. [https://www.theverge.com/2024/6/2/24169556/nvidia-rubin-ai-gpu-platform-2026-computex](https://www.theverge.com/2024/6/2/24169556/nvidia-rubin-ai-gpu-platform-2026-computex)

[42] EVAN, M. (2024, June 3). AMD Unveils Next-Gen MI400 AI Accelerators and Ryzen AI 300 CPUs. *Wccftech*. [https://wccftech.com/amd-unveils-next-gen-mi400-ai-accelerators-and-ryzen-ai-300-cpus/](https://wccftech.com/amd-unveils-next-gen-mi400-ai-accelerators-and-ryzen-ai-300-cpus/)

[43] Patel, D. (2023, December 7). AMD MI300X: The Datacenter GPU That Will Shape The Future of AI. *SemiAnalysis*. [https://www.semianalysis.com/p/amd-mi300x-the-datacenter-gpu-that](https://www.semianalysis.com/p/amd-mi300x-the-datacenter-gpu-that)

[44] IDC. (2023, October 25). Worldwide AI and Generative AI Spending Forecast to Surge. *IDC Press Release*. [https://www.idc.com/getdoc.jsp?containerId=prUS51305323](https://www.idc.com/getdoc.jsp?containerId=prUS51305323)

[45] Alper, A., & Baptista, E. (2023, November 17). Nvidia's new H20 chip for China faces hurdles. *Reuters*. [https://www.reuters.com/technology/nvidias-new-h20-chip-china-faces-hurdles-2023-11-17/](https://www.reuters.com/technology/nvidias-new-h20-chip-china-faces-hurdles-2023-11-17/)

[46] Liu, C. (2024, March 5). Huawei's Ascend 910B AI Chip Narrows Gap with Nvidia's A100. *Reuters*. [https://www.reuters.com/technology/huaweis-ascend-910b-ai-chip-narrows-gap-with-nvidias-a100-scmp-2024-03-05/](https://www.reuters.com/technology/huaweis-ascend-910b-ai-chip-narrows-gap-with-nvidias-a100-scmp-2024-03-05/)

[47] King, I. (2023, October 18). US Curbs on AI Chip Exports to China Hit AMD and Nvidia. *Bloomberg*. [https://www.bloomberg.com/news/articles/2023-10-18/us-curbs-on-ai-chip-exports-to-china-hit-amd-and-nvidia](https://www.bloomberg.com/news/articles/2023-10-18/us-curbs-on-ai-chip-exports-to-china-hit-amd-and-nvidia)